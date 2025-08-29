-- 006_tool_registry.sql
-- Tool registry, execution, and management system

-- Tools registry table
CREATE TABLE tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for system tools
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    icon VARCHAR(500), -- Icon URL or name
    
    -- Tool configuration
    schema JSONB NOT NULL, -- JSON Schema for parameters
    config JSONB DEFAULT '{}', -- Tool-specific configuration
    endpoint_url TEXT, -- For external tools
    auth_config JSONB DEFAULT '{}', -- Authentication configuration
    
    -- Tool properties
    is_system BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE, -- Can be used by other tenants
    requires_auth BOOLEAN DEFAULT FALSE,
    requires_confirmation BOOLEAN DEFAULT FALSE,
    
    -- Execution settings
    timeout_seconds INTEGER DEFAULT 30,
    max_executions_per_minute INTEGER DEFAULT 60,
    max_executions_per_hour INTEGER DEFAULT 1000,
    cost_per_execution_cents INTEGER DEFAULT 0,
    
    -- Version and lifecycle
    version VARCHAR(50) DEFAULT '1.0.0',
    deprecated_at TIMESTAMP WITH TIME ZONE,
    deprecation_message TEXT,
    
    -- Usage statistics
    total_executions BIGINT DEFAULT 0,
    successful_executions BIGINT DEFAULT 0,
    average_duration_ms FLOAT DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags VARCHAR(100)[] DEFAULT '{}',
    documentation_url TEXT,
    source_url TEXT,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_tool_name_per_tenant UNIQUE(COALESCE(tenant_id, uuid_nil()), name),
    CONSTRAINT valid_timeout CHECK (timeout_seconds > 0 AND timeout_seconds <= 300),
    CONSTRAINT valid_rate_limits CHECK (
        max_executions_per_minute > 0 AND 
        max_executions_per_hour > 0 AND
        max_executions_per_hour >= max_executions_per_minute
    )
);

-- Tool executions table
CREATE TABLE tool_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    -- Execution details
    status tool_execution_status DEFAULT 'pending',
    parameters JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error_message TEXT,
    error_code VARCHAR(100),
    
    -- Timing and performance
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    -- Resources and costs
    memory_used_mb FLOAT,
    cpu_time_ms FLOAT,
    cost_cents INTEGER DEFAULT 0,
    
    -- Execution context
    execution_id VARCHAR(255), -- External execution ID if applicable
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Audit trail
    execution_log JSONB DEFAULT '[]', -- Array of log entries
    debug_info JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tool execution steps for complex multi-step tools
CREATE TABLE tool_execution_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES tool_executions(id) ON DELETE CASCADE,
    step_name VARCHAR(255) NOT NULL,
    step_order INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    input_data JSONB DEFAULT '{}',
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    UNIQUE(execution_id, step_order)
);

-- Tool permissions and access control
CREATE TABLE tool_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    permission_type VARCHAR(50) NOT NULL, -- execute, configure, admin
    restrictions JSONB DEFAULT '{}', -- Parameter restrictions, rate limits, etc.
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT tool_permission_target CHECK (
        (user_id IS NOT NULL AND role_id IS NULL AND workspace_id IS NULL) OR
        (user_id IS NULL AND role_id IS NOT NULL AND workspace_id IS NULL) OR
        (user_id IS NULL AND role_id IS NULL AND workspace_id IS NOT NULL)
    )
);

-- Tool rate limiting and usage tracking
CREATE TABLE tool_usage_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Limits
    executions_per_minute INTEGER DEFAULT NULL,
    executions_per_hour INTEGER DEFAULT NULL,
    executions_per_day INTEGER DEFAULT NULL,
    max_concurrent_executions INTEGER DEFAULT NULL,
    
    -- Current usage (reset periodically)
    current_minute_executions INTEGER DEFAULT 0,
    current_hour_executions INTEGER DEFAULT 0,
    current_day_executions INTEGER DEFAULT 0,
    current_concurrent_executions INTEGER DEFAULT 0,
    
    -- Reset timestamps
    last_minute_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_hour_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_day_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT tool_usage_limit_target CHECK (
        (user_id IS NOT NULL AND tenant_id IS NULL) OR
        (user_id IS NULL AND tenant_id IS NOT NULL)
    ),
    UNIQUE(tool_id, user_id),
    UNIQUE(tool_id, tenant_id)
);

-- Tool webhooks for external integrations
CREATE TABLE tool_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    webhook_url TEXT NOT NULL,
    secret_token VARCHAR(255),
    event_types VARCHAR(100)[] DEFAULT '{}', -- execution_started, execution_completed, execution_failed
    is_active BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tool marketplace and ratings
CREATE TABLE tool_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    helpful_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tool_id, user_id)
);

-- Tool dependencies and relationships
CREATE TABLE tool_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    dependency_tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL, -- required, optional, suggests
    version_constraint VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tool_id, dependency_tool_id),
    CONSTRAINT no_self_dependency CHECK (tool_id != dependency_tool_id)
);

-- Create indexes for performance
CREATE INDEX idx_tools_tenant_id ON tools(tenant_id);
CREATE INDEX idx_tools_name ON tools(name);
CREATE INDEX idx_tools_category ON tools(category);
CREATE INDEX idx_tools_enabled ON tools(is_enabled) WHERE is_enabled = TRUE;
CREATE INDEX idx_tools_public ON tools(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_tools_system ON tools(is_system) WHERE is_system = TRUE;
CREATE INDEX idx_tools_tags ON tools USING GIN (tags);
CREATE INDEX idx_tools_executions ON tools(total_executions DESC);
CREATE INDEX idx_tools_last_executed ON tools(last_executed_at DESC) WHERE last_executed_at IS NOT NULL;

CREATE INDEX idx_tool_executions_tool_id ON tool_executions(tool_id);
CREATE INDEX idx_tool_executions_user_id ON tool_executions(user_id);
CREATE INDEX idx_tool_executions_conversation_id ON tool_executions(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_tool_executions_message_id ON tool_executions(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_tool_executions_status ON tool_executions(status);
CREATE INDEX idx_tool_executions_started_at ON tool_executions(started_at DESC);
CREATE INDEX idx_tool_executions_completed_at ON tool_executions(completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_tool_executions_duration ON tool_executions(duration_ms) WHERE duration_ms IS NOT NULL;
CREATE INDEX idx_tool_executions_user_status ON tool_executions(user_id, status, started_at DESC);
CREATE INDEX idx_tool_executions_tool_status ON tool_executions(tool_id, status, started_at DESC);

CREATE INDEX idx_tool_execution_steps_execution_id ON tool_execution_steps(execution_id);
CREATE INDEX idx_tool_execution_steps_order ON tool_execution_steps(execution_id, step_order);

CREATE INDEX idx_tool_permissions_tool_id ON tool_permissions(tool_id);
CREATE INDEX idx_tool_permissions_user_id ON tool_permissions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_tool_permissions_role_id ON tool_permissions(role_id) WHERE role_id IS NOT NULL;
CREATE INDEX idx_tool_permissions_workspace_id ON tool_permissions(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE INDEX idx_tool_usage_limits_tool_user ON tool_usage_limits(tool_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_tool_usage_limits_tool_tenant ON tool_usage_limits(tool_id, tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_tool_webhooks_tool_id ON tool_webhooks(tool_id);
CREATE INDEX idx_tool_webhooks_active ON tool_webhooks(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_tool_ratings_tool_id ON tool_ratings(tool_id);
CREATE INDEX idx_tool_ratings_user_id ON tool_ratings(user_id);
CREATE INDEX idx_tool_ratings_rating ON tool_ratings(tool_id, rating);

CREATE INDEX idx_tool_dependencies_tool_id ON tool_dependencies(tool_id);
CREATE INDEX idx_tool_dependencies_dependency_id ON tool_dependencies(dependency_tool_id);

-- Enable RLS
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_execution_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_dependencies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY tool_access ON tools FOR ALL TO authenticated 
USING (
    is_system = TRUE OR 
    tenant_id = get_current_tenant_id() OR 
    (is_public = TRUE AND is_enabled = TRUE)
);

CREATE POLICY tool_execution_user_access ON tool_executions FOR ALL TO authenticated 
USING (
    user_id = auth.uid() OR
    tool_id IN (
        SELECT id FROM tools 
        WHERE tenant_id = get_current_tenant_id() 
        OR is_system = TRUE
    )
);

-- Create trigger to update tool execution statistics
CREATE OR REPLACE FUNCTION update_tool_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        IF NEW.status = 'completed' THEN
            UPDATE tools 
            SET 
                total_executions = total_executions + 1,
                successful_executions = successful_executions + 1,
                last_executed_at = NEW.completed_at,
                average_duration_ms = CASE 
                    WHEN total_executions = 0 THEN NEW.duration_ms
                    ELSE (average_duration_ms * total_executions + COALESCE(NEW.duration_ms, 0)) / (total_executions + 1)
                END,
                updated_at = NOW()
            WHERE id = NEW.tool_id;
        ELSIF NEW.status = 'failed' THEN
            UPDATE tools 
            SET 
                total_executions = total_executions + 1,
                last_executed_at = COALESCE(NEW.completed_at, NEW.started_at),
                updated_at = NOW()
            WHERE id = NEW.tool_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tool_stats
    AFTER UPDATE ON tool_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_tool_stats();

-- Function to check tool execution permissions
CREATE OR REPLACE FUNCTION can_execute_tool(
    p_tool_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    tool_record tools%ROWTYPE;
    has_permission BOOLEAN := FALSE;
BEGIN
    -- Get tool details
    SELECT * INTO tool_record FROM tools WHERE id = p_tool_id;
    
    IF NOT FOUND OR NOT tool_record.is_enabled THEN
        RETURN FALSE;
    END IF;
    
    -- System tools are available to all authenticated users
    IF tool_record.is_system THEN
        RETURN TRUE;
    END IF;
    
    -- Public tools are available to all users
    IF tool_record.is_public THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user belongs to tool's tenant
    IF tool_record.tenant_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM users 
            WHERE id = p_user_id AND tenant_id = tool_record.tenant_id
        ) INTO has_permission;
        
        IF has_permission THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Check explicit permissions
    SELECT EXISTS(
        SELECT 1 FROM tool_permissions tp
        WHERE tp.tool_id = p_tool_id 
        AND (
            tp.user_id = p_user_id OR
            tp.role_id IN (SELECT role_id FROM user_roles WHERE user_id = p_user_id)
        )
        AND tp.permission_type IN ('execute', 'admin')
        AND (tp.expires_at IS NULL OR tp.expires_at > NOW())
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to reset usage limits
CREATE OR REPLACE FUNCTION reset_tool_usage_limits()
RETURNS VOID AS $$
DECLARE
    current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- Reset minute limits
    UPDATE tool_usage_limits 
    SET 
        current_minute_executions = 0,
        last_minute_reset = current_time,
        updated_at = current_time
    WHERE last_minute_reset < current_time - INTERVAL '1 minute';
    
    -- Reset hour limits
    UPDATE tool_usage_limits 
    SET 
        current_hour_executions = 0,
        last_hour_reset = current_time,
        updated_at = current_time
    WHERE last_hour_reset < current_time - INTERVAL '1 hour';
    
    -- Reset day limits
    UPDATE tool_usage_limits 
    SET 
        current_day_executions = 0,
        last_day_reset = current_time,
        updated_at = current_time
    WHERE last_day_reset < current_time - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert this migration
INSERT INTO schema_migrations (version, checksum) 
VALUES ('006', md5('006_tool_registry.sql'))
ON CONFLICT (version) DO NOTHING;