-- 003_tenant_system.sql
-- Multi-tenant system setup with workspaces and isolation

-- Workspaces table for organizing conversations and resources within tenants
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_workspace_slug CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
    UNIQUE(tenant_id, slug)
);

-- Tenant settings and configuration
CREATE TABLE tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    category VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, key)
);

-- Tenant feature flags
CREATE TABLE tenant_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_key VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    config JSONB DEFAULT '{}',
    enabled_at TIMESTAMP WITH TIME ZONE,
    enabled_by UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, feature_key)
);

-- Tenant limits and quotas
CREATE TABLE tenant_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL, -- users, conversations, storage, api_calls, etc.
    limit_value BIGINT NOT NULL,
    current_usage BIGINT DEFAULT 0,
    reset_period VARCHAR(50), -- monthly, daily, none
    last_reset_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, resource_type)
);

-- Tenant integrations and external services
CREATE TABLE tenant_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    integration_type VARCHAR(100) NOT NULL, -- stripe, slack, jira, etc.
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    credentials JSONB DEFAULT '{}', -- Encrypted credentials
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, integration_type, name)
);

-- Tenant invitations
CREATE TABLE tenant_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id),
    workspace_id UUID REFERENCES workspaces(id),
    invited_by UUID NOT NULL REFERENCES users(id),
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_invitation_email CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$')
);

-- Update user_roles to reference workspaces
ALTER TABLE user_roles ADD CONSTRAINT user_roles_workspace_fk 
FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add tenant isolation function for RLS
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX idx_workspaces_tenant_id ON workspaces(tenant_id);
CREATE INDEX idx_workspaces_tenant_slug ON workspaces(tenant_id, slug);
CREATE INDEX idx_workspaces_is_default ON workspaces(tenant_id, is_default) WHERE is_default = TRUE;

CREATE INDEX idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);
CREATE INDEX idx_tenant_settings_key ON tenant_settings(key);
CREATE INDEX idx_tenant_settings_category ON tenant_settings(category);

CREATE INDEX idx_tenant_features_tenant_id ON tenant_features(tenant_id);
CREATE INDEX idx_tenant_features_key ON tenant_features(feature_key);
CREATE INDEX idx_tenant_features_enabled ON tenant_features(tenant_id, is_enabled) WHERE is_enabled = TRUE;

CREATE INDEX idx_tenant_limits_tenant_id ON tenant_limits(tenant_id);
CREATE INDEX idx_tenant_limits_resource ON tenant_limits(resource_type);
CREATE INDEX idx_tenant_limits_usage ON tenant_limits(tenant_id, current_usage);

CREATE INDEX idx_tenant_integrations_tenant_id ON tenant_integrations(tenant_id);
CREATE INDEX idx_tenant_integrations_type ON tenant_integrations(integration_type);
CREATE INDEX idx_tenant_integrations_active ON tenant_integrations(tenant_id, is_active) WHERE is_active = TRUE;

CREATE INDEX idx_tenant_invitations_tenant_id ON tenant_invitations(tenant_id);
CREATE INDEX idx_tenant_invitations_email ON tenant_invitations(email);
CREATE INDEX idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX idx_tenant_invitations_expires ON tenant_invitations(expires_at);

-- Enable RLS on new tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (application will define specific policies)
CREATE POLICY workspace_tenant_isolation ON workspaces FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_settings_isolation ON tenant_settings FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_features_isolation ON tenant_features FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_limits_isolation ON tenant_limits FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_integrations_isolation ON tenant_integrations FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY tenant_invitations_isolation ON tenant_invitations FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

-- Create trigger to ensure only one default workspace per tenant
CREATE OR REPLACE FUNCTION enforce_single_default_workspace()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE workspaces 
        SET is_default = FALSE, updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id 
        AND id != COALESCE(NEW.id, uuid_generate_v4())
        AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_single_default_workspace
    BEFORE INSERT OR UPDATE ON workspaces
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION enforce_single_default_workspace();

-- Create function to update tenant usage
CREATE OR REPLACE FUNCTION update_tenant_usage(
    p_tenant_id UUID,
    p_resource_type VARCHAR(100),
    p_delta BIGINT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO tenant_limits (tenant_id, resource_type, limit_value, current_usage)
    VALUES (p_tenant_id, p_resource_type, 0, GREATEST(0, p_delta))
    ON CONFLICT (tenant_id, resource_type)
    DO UPDATE SET 
        current_usage = GREATEST(0, tenant_limits.current_usage + p_delta),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert this migration
INSERT INTO schema_migrations (version, checksum) 
VALUES ('003', md5('003_tenant_system.sql'))
ON CONFLICT (version) DO NOTHING;