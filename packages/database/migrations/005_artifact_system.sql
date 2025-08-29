-- 005_artifact_system.sql
-- Artifact storage, versioning, and management system

-- Artifacts table
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Artifact metadata
    type artifact_type NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    tags VARCHAR(100)[] DEFAULT '{}',
    
    -- Content storage
    content JSONB, -- For small artifacts (JSON, config, etc.)
    content_text TEXT, -- For text-based artifacts
    storage_url TEXT, -- For large artifacts in object storage
    thumbnail_url TEXT,
    size_bytes BIGINT DEFAULT 0,
    
    -- Versioning
    parent_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    version INTEGER DEFAULT 1,
    version_label VARCHAR(100),
    is_latest_version BOOLEAN DEFAULT TRUE,
    
    -- Access and sharing
    is_public BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    
    -- Processing status
    processing_status VARCHAR(50) DEFAULT 'completed', -- pending, processing, completed, failed
    processing_error TEXT,
    processing_metadata JSONB DEFAULT '{}',
    
    -- Metadata and settings
    metadata JSONB DEFAULT '{}',
    render_config JSONB DEFAULT '{}',
    export_formats VARCHAR(50)[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Artifact versions view for easier querying
CREATE VIEW artifact_versions AS
SELECT 
    a.*,
    CASE 
        WHEN a.parent_artifact_id IS NULL THEN a.id
        ELSE COALESCE(parent.id, a.id)
    END as root_artifact_id,
    (
        SELECT COUNT(*)
        FROM artifacts child
        WHERE child.parent_artifact_id = COALESCE(a.parent_artifact_id, a.id)
        OR child.id = COALESCE(a.parent_artifact_id, a.id)
    ) as version_count
FROM artifacts a
LEFT JOIN artifacts parent ON a.parent_artifact_id = parent.id;

-- Artifact collections for grouping related artifacts
CREATE TABLE artifact_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- Junction table for artifacts in collections
CREATE TABLE artifact_collection_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES artifact_collections(id) ON DELETE CASCADE,
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(collection_id, artifact_id)
);

-- Artifact comments and collaboration
CREATE TABLE artifact_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES artifact_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Artifact access permissions
CREATE TABLE artifact_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    permission_type VARCHAR(50) NOT NULL, -- read, write, admin, comment
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT artifact_permission_target CHECK (
        (user_id IS NOT NULL AND role_id IS NULL AND workspace_id IS NULL) OR
        (user_id IS NULL AND role_id IS NOT NULL AND workspace_id IS NULL) OR
        (user_id IS NULL AND role_id IS NULL AND workspace_id IS NOT NULL)
    )
);

-- Artifact export history
CREATE TABLE artifact_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    export_format VARCHAR(50) NOT NULL,
    export_url TEXT,
    file_size BIGINT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, expired
    error_message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Artifact analytics and metrics
CREATE TABLE artifact_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- view, download, share, comment, fork
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partition key for time-based partitioning
    event_date DATE GENERATED ALWAYS AS (created_at::DATE) STORED
);

-- Create partitioned table for artifact analytics
-- (This would be done in a production setup, commenting out for compatibility)
-- ALTER TABLE artifact_analytics PARTITION BY RANGE (event_date);

-- Artifact relationships (references, dependencies, etc.)
CREATE TABLE artifact_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    target_artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL, -- references, depends_on, derived_from, similar_to
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(source_artifact_id, target_artifact_id, relationship_type),
    CONSTRAINT no_self_reference CHECK (source_artifact_id != target_artifact_id)
);

-- Create indexes for performance
CREATE INDEX idx_artifacts_tenant_id ON artifacts(tenant_id);
CREATE INDEX idx_artifacts_conversation_id ON artifacts(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_artifacts_message_id ON artifacts(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_artifacts_user_id ON artifacts(user_id);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_parent_id ON artifacts(parent_artifact_id) WHERE parent_artifact_id IS NOT NULL;
CREATE INDEX idx_artifacts_latest_version ON artifacts(parent_artifact_id, is_latest_version) WHERE is_latest_version = TRUE;
CREATE INDEX idx_artifacts_public ON artifacts(tenant_id, is_public) WHERE is_public = TRUE;
CREATE INDEX idx_artifacts_featured ON artifacts(tenant_id, is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);
CREATE INDEX idx_artifacts_tags ON artifacts USING GIN (tags);
CREATE INDEX idx_artifacts_processing_status ON artifacts(processing_status) WHERE processing_status != 'completed';

CREATE INDEX idx_artifact_collections_tenant_id ON artifact_collections(tenant_id);
CREATE INDEX idx_artifact_collections_slug ON artifact_collections(tenant_id, slug);
CREATE INDEX idx_artifact_collections_public ON artifact_collections(tenant_id, is_public) WHERE is_public = TRUE;
CREATE INDEX idx_artifact_collections_created_by ON artifact_collections(created_by);

CREATE INDEX idx_artifact_collection_items_collection_id ON artifact_collection_items(collection_id);
CREATE INDEX idx_artifact_collection_items_artifact_id ON artifact_collection_items(artifact_id);
CREATE INDEX idx_artifact_collection_items_position ON artifact_collection_items(collection_id, position);

CREATE INDEX idx_artifact_comments_artifact_id ON artifact_comments(artifact_id);
CREATE INDEX idx_artifact_comments_user_id ON artifact_comments(user_id);
CREATE INDEX idx_artifact_comments_parent_id ON artifact_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_artifact_comments_created_at ON artifact_comments(created_at DESC);

CREATE INDEX idx_artifact_permissions_artifact_id ON artifact_permissions(artifact_id);
CREATE INDEX idx_artifact_permissions_user_id ON artifact_permissions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_artifact_permissions_role_id ON artifact_permissions(role_id) WHERE role_id IS NOT NULL;
CREATE INDEX idx_artifact_permissions_workspace_id ON artifact_permissions(workspace_id) WHERE workspace_id IS NOT NULL;

CREATE INDEX idx_artifact_exports_artifact_id ON artifact_exports(artifact_id);
CREATE INDEX idx_artifact_exports_user_id ON artifact_exports(user_id);
CREATE INDEX idx_artifact_exports_status ON artifact_exports(status);
CREATE INDEX idx_artifact_exports_expires ON artifact_exports(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_artifact_analytics_artifact_id ON artifact_analytics(artifact_id);
CREATE INDEX idx_artifact_analytics_user_id ON artifact_analytics(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_artifact_analytics_event_type ON artifact_analytics(event_type);
CREATE INDEX idx_artifact_analytics_created_at ON artifact_analytics(created_at DESC);
CREATE INDEX idx_artifact_analytics_date ON artifact_analytics(event_date);

CREATE INDEX idx_artifact_relationships_source ON artifact_relationships(source_artifact_id);
CREATE INDEX idx_artifact_relationships_target ON artifact_relationships(target_artifact_id);
CREATE INDEX idx_artifact_relationships_type ON artifact_relationships(relationship_type);

-- Enable RLS
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_relationships ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY artifact_tenant_isolation ON artifacts FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY artifact_collection_tenant_isolation ON artifact_collections FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

-- Create trigger to maintain latest version flag
CREATE OR REPLACE FUNCTION update_artifact_latest_version()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new version of an existing artifact
    IF NEW.parent_artifact_id IS NOT NULL AND NEW.is_latest_version = TRUE THEN
        -- Mark all other versions as not latest
        UPDATE artifacts 
        SET is_latest_version = FALSE, updated_at = NOW()
        WHERE (parent_artifact_id = NEW.parent_artifact_id OR id = NEW.parent_artifact_id)
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_artifact_latest_version
    AFTER INSERT OR UPDATE ON artifacts
    FOR EACH ROW
    WHEN (NEW.is_latest_version = TRUE AND NEW.parent_artifact_id IS NOT NULL)
    EXECUTE FUNCTION update_artifact_latest_version();

-- Create trigger to update artifact analytics
CREATE OR REPLACE FUNCTION track_artifact_view()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE artifacts 
    SET view_count = view_count + 1, updated_at = NOW()
    WHERE id = NEW.artifact_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_artifact_view
    AFTER INSERT ON artifact_analytics
    FOR EACH ROW
    WHEN (NEW.event_type = 'view')
    EXECUTE FUNCTION track_artifact_view();

-- Function to get artifact with permissions
CREATE OR REPLACE FUNCTION get_artifact_with_permissions(
    p_artifact_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    artifact artifacts,
    can_read BOOLEAN,
    can_write BOOLEAN,
    can_admin BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.*,
        -- Check if user can read (owner, public, or has permission)
        (
            a.user_id = p_user_id OR 
            a.is_public = TRUE OR
            EXISTS (
                SELECT 1 FROM artifact_permissions ap
                WHERE ap.artifact_id = a.id 
                AND (
                    ap.user_id = p_user_id OR
                    ap.role_id IN (SELECT role_id FROM user_roles WHERE user_id = p_user_id)
                )
                AND ap.permission_type IN ('read', 'write', 'admin')
                AND (ap.expires_at IS NULL OR ap.expires_at > NOW())
            )
        ) as can_read,
        -- Check if user can write
        (
            a.user_id = p_user_id OR
            EXISTS (
                SELECT 1 FROM artifact_permissions ap
                WHERE ap.artifact_id = a.id 
                AND (
                    ap.user_id = p_user_id OR
                    ap.role_id IN (SELECT role_id FROM user_roles WHERE user_id = p_user_id)
                )
                AND ap.permission_type IN ('write', 'admin')
                AND (ap.expires_at IS NULL OR ap.expires_at > NOW())
            )
        ) as can_write,
        -- Check if user can admin
        (
            a.user_id = p_user_id OR
            EXISTS (
                SELECT 1 FROM artifact_permissions ap
                WHERE ap.artifact_id = a.id 
                AND (
                    ap.user_id = p_user_id OR
                    ap.role_id IN (SELECT role_id FROM user_roles WHERE user_id = p_user_id)
                )
                AND ap.permission_type = 'admin'
                AND (ap.expires_at IS NULL OR ap.expires_at > NOW())
            )
        ) as can_admin
    FROM artifacts a
    WHERE a.id = p_artifact_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Insert this migration
INSERT INTO schema_migrations (version, checksum) 
VALUES ('005', md5('005_artifact_system.sql'))
ON CONFLICT (version) DO NOTHING;