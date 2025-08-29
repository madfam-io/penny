-- 004_conversation_system.sql
-- Chat conversations and message system

-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    summary TEXT,
    metadata JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    is_archived BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL, -- user, assistant, system, tool
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- text, markdown, html
    metadata JSONB DEFAULT '{}',
    tool_calls JSONB,
    tool_call_id VARCHAR(255),
    function_call JSONB,
    name VARCHAR(255), -- For tool/function messages
    token_count INTEGER DEFAULT 0,
    model VARCHAR(255),
    provider VARCHAR(100),
    cost_cents INTEGER DEFAULT 0,
    latency_ms INTEGER,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system', 'tool', 'function'))
);

-- Message reactions table
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(message_id, user_id, emoji)
);

-- Conversation participants for shared conversations
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'participant', -- owner, admin, participant, viewer
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(conversation_id, user_id)
);

-- Conversation memory/context storage with vector embeddings
CREATE TABLE conversation_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimension
    metadata JSONB DEFAULT '{}',
    importance_score FLOAT DEFAULT 0.0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(conversation_id, key)
);

-- Message attachments
CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_url TEXT,
    metadata JSONB DEFAULT '{}',
    is_processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50) DEFAULT 'pending',
    processing_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Conversation templates
CREATE TABLE conversation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template JSONB NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    tags VARCHAR(100)[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, name)
);

-- Conversation sharing
CREATE TABLE conversation_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    share_token VARCHAR(255) NOT NULL UNIQUE,
    shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_type VARCHAR(50) DEFAULT 'read', -- read, comment, edit
    expires_at TIMESTAMP WITH TIME ZONE,
    password_hash VARCHAR(255),
    allow_download BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);
CREATE INDEX idx_conversations_workspace_id ON conversations(workspace_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_archived ON conversations(is_archived);
CREATE INDEX idx_conversations_pinned ON conversations(tenant_id, is_pinned) WHERE is_pinned = TRUE;

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_parent_id ON messages(parent_message_id);
CREATE INDEX idx_messages_tool_call_id ON messages(tool_call_id) WHERE tool_call_id IS NOT NULL;
CREATE INDEX idx_messages_deleted ON messages(is_deleted) WHERE is_deleted = FALSE;

CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);

CREATE INDEX idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_active ON conversation_participants(conversation_id) WHERE left_at IS NULL;

CREATE INDEX idx_conversation_memory_conversation_id ON conversation_memory(conversation_id);
CREATE INDEX idx_conversation_memory_key ON conversation_memory(conversation_id, key);
CREATE INDEX idx_conversation_memory_expires ON conversation_memory(expires_at) WHERE expires_at IS NOT NULL;
-- Vector similarity search index
CREATE INDEX idx_conversation_memory_embedding ON conversation_memory USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX idx_message_attachments_processed ON message_attachments(is_processed, processing_status);

CREATE INDEX idx_conversation_templates_tenant_id ON conversation_templates(tenant_id);
CREATE INDEX idx_conversation_templates_category ON conversation_templates(category);
CREATE INDEX idx_conversation_templates_active ON conversation_templates(tenant_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_conversation_templates_tags ON conversation_templates USING GIN (tags);

CREATE INDEX idx_conversation_shares_conversation_id ON conversation_shares(conversation_id);
CREATE INDEX idx_conversation_shares_token ON conversation_shares(share_token);
CREATE INDEX idx_conversation_shares_expires ON conversation_shares(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_conversation_shares_active ON conversation_shares(is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_shares ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY conversation_tenant_isolation ON conversations FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY message_conversation_access ON messages FOR ALL TO authenticated 
USING (
    conversation_id IN (
        SELECT id FROM conversations WHERE tenant_id = get_current_tenant_id()
    )
);

CREATE POLICY memory_conversation_access ON conversation_memory FOR ALL TO authenticated 
USING (
    conversation_id IN (
        SELECT id FROM conversations WHERE tenant_id = get_current_tenant_id()
    )
);

-- Create trigger to update conversation updated_at on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = NOW(), last_message_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- Create function to search conversation memory by similarity
CREATE OR REPLACE FUNCTION search_conversation_memory(
    p_conversation_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 10,
    p_similarity_threshold FLOAT DEFAULT 0.8
)
RETURNS TABLE (
    id UUID,
    key VARCHAR(255),
    value TEXT,
    similarity FLOAT,
    importance_score FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id,
        cm.key,
        cm.value,
        (1 - (cm.embedding <=> p_query_embedding))::FLOAT as similarity,
        cm.importance_score,
        cm.metadata
    FROM conversation_memory cm
    WHERE cm.conversation_id = p_conversation_id
    AND cm.embedding IS NOT NULL
    AND (cm.expires_at IS NULL OR cm.expires_at > NOW())
    AND (1 - (cm.embedding <=> p_query_embedding)) >= p_similarity_threshold
    ORDER BY cm.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Insert this migration
INSERT INTO schema_migrations (version, checksum) 
VALUES ('004', md5('004_conversation_system.sql'))
ON CONFLICT (version) DO NOTHING;