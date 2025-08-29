-- 009_webhooks_notifications.sql
-- Webhooks, notifications, and external integrations system

-- Webhook endpoints table
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Endpoint configuration
    url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'POST',
    headers JSONB DEFAULT '{}',
    
    -- Authentication
    auth_type VARCHAR(50), -- none, basic, bearer, api_key, oauth2
    auth_config JSONB DEFAULT '{}', -- Encrypted auth details
    
    -- Event configuration
    events VARCHAR(100)[] NOT NULL DEFAULT '{}', -- Array of event types to listen for
    event_filter JSONB DEFAULT '{}', -- Additional filtering conditions
    
    -- Security
    secret_token VARCHAR(500), -- For webhook signature verification
    verify_ssl BOOLEAN DEFAULT TRUE,
    
    -- Delivery settings
    timeout_seconds INTEGER DEFAULT 30,
    max_retries INTEGER DEFAULT 3,
    retry_backoff VARCHAR(50) DEFAULT 'exponential', -- linear, exponential, fixed
    retry_delay_seconds INTEGER DEFAULT 1,
    
    -- Status and lifecycle
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_ping_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    
    -- Statistics
    total_deliveries BIGINT DEFAULT 0,
    successful_deliveries BIGINT DEFAULT 0,
    failed_deliveries BIGINT DEFAULT 0,
    average_response_time_ms FLOAT DEFAULT 0,
    last_delivery_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags VARCHAR(100)[] DEFAULT '{}',
    
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_timeout CHECK (timeout_seconds > 0 AND timeout_seconds <= 300),
    CONSTRAINT valid_retries CHECK (max_retries >= 0 AND max_retries <= 10),
    CONSTRAINT valid_method CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'))
);

-- Webhook deliveries table
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_id UUID NOT NULL,
    payload JSONB NOT NULL,
    
    -- Delivery details
    status webhook_status DEFAULT 'pending',
    attempt_number INTEGER DEFAULT 1,
    
    -- Request details
    request_headers JSONB DEFAULT '{}',
    request_body JSONB,
    request_url TEXT NOT NULL,
    request_method VARCHAR(10) NOT NULL,
    
    -- Response details
    response_status_code INTEGER,
    response_headers JSONB DEFAULT '{}',
    response_body TEXT,
    response_time_ms INTEGER,
    
    -- Error handling
    error_message TEXT,
    error_code VARCHAR(100),
    
    -- Timing
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification channels table
CREATE TABLE notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Channel configuration
    type VARCHAR(100) NOT NULL, -- email, sms, slack, teams, discord, webhook
    config JSONB NOT NULL DEFAULT '{}',
    
    -- Email specific
    email_addresses TEXT[], -- For email channels
    email_template_id UUID,
    
    -- Webhook specific
    webhook_url TEXT,
    webhook_headers JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Statistics
    total_notifications BIGINT DEFAULT 0,
    successful_notifications BIGINT DEFAULT 0,
    failed_notifications BIGINT DEFAULT 0,
    
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, name)
);

-- Notification templates table
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for system templates
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Template content
    subject_template TEXT,
    body_template TEXT NOT NULL,
    html_template TEXT,
    
    -- Template configuration
    template_engine VARCHAR(50) DEFAULT 'handlebars', -- handlebars, mustache, ejs
    variables JSONB DEFAULT '{}', -- Available template variables
    
    -- Channel support
    supported_channels VARCHAR(100)[] DEFAULT '{}',
    
    -- Status
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(COALESCE(tenant_id, uuid_nil()), name)
);

-- Notification rules table
CREATE TABLE notification_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Rule conditions
    event_types VARCHAR(100)[] NOT NULL,
    conditions JSONB DEFAULT '{}', -- JSON conditions for filtering
    
    -- Recipients
    channels UUID[] NOT NULL, -- Array of notification_channel IDs
    recipient_users UUID[], -- Array of specific user IDs
    recipient_roles VARCHAR(100)[], -- Array of role names
    
    -- Template and content
    template_id UUID REFERENCES notification_templates(id),
    custom_subject VARCHAR(500),
    custom_message TEXT,
    
    -- Delivery settings
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    delay_seconds INTEGER DEFAULT 0,
    digest_interval_minutes INTEGER, -- For batching notifications
    
    -- Status and lifecycle
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Statistics
    total_triggered BIGINT DEFAULT 0,
    total_sent BIGINT DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, name)
);

-- Notification history table
CREATE TABLE notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL,
    channel_id UUID REFERENCES notification_channels(id) ON DELETE SET NULL,
    template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_id UUID NOT NULL,
    event_data JSONB DEFAULT '{}',
    
    -- Notification details
    recipient_type VARCHAR(50) NOT NULL, -- user, channel, email, phone
    recipient_address TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    
    -- Delivery status
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, failed, bounced
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- External service data
    external_id VARCHAR(255), -- Message ID from external service
    external_status VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User notification preferences
CREATE TABLE user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Channel preferences
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    
    -- Event type preferences
    event_preferences JSONB DEFAULT '{}', -- Per-event type preferences
    
    -- Delivery preferences
    digest_enabled BOOLEAN DEFAULT FALSE,
    digest_frequency VARCHAR(50) DEFAULT 'daily', -- immediate, hourly, daily, weekly
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(100) DEFAULT 'UTC',
    
    -- Contact details
    phone_number VARCHAR(50),
    phone_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- In-app notifications table (extends base notifications table)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification details
    type notification_type DEFAULT 'info',
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    action_label VARCHAR(100),
    
    -- Event context
    event_type VARCHAR(100),
    event_id UUID,
    resource_type VARCHAR(100),
    resource_id UUID,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event log table for tracking all system events
CREATE TABLE event_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_name VARCHAR(255),
    event_data JSONB DEFAULT '{}',
    
    -- Source information
    source_service VARCHAR(100),
    source_version VARCHAR(50),
    correlation_id VARCHAR(255),
    
    -- Context
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partition key
    event_date DATE GENERATED ALWAYS AS (occurred_at::DATE) STORED
);

-- Create indexes for performance
CREATE INDEX idx_webhooks_tenant_id ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_active ON webhooks(tenant_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_webhooks_events ON webhooks USING GIN (events);
CREATE INDEX idx_webhooks_last_delivery ON webhooks(last_delivery_at DESC) WHERE last_delivery_at IS NOT NULL;

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
CREATE INDEX idx_webhook_deliveries_scheduled ON webhook_deliveries(scheduled_at);
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL;

CREATE INDEX idx_notification_channels_tenant_id ON notification_channels(tenant_id);
CREATE INDEX idx_notification_channels_type ON notification_channels(type);
CREATE INDEX idx_notification_channels_active ON notification_channels(tenant_id, is_active) WHERE is_active = TRUE;

CREATE INDEX idx_notification_templates_tenant_id ON notification_templates(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_notification_templates_system ON notification_templates(is_system) WHERE is_system = TRUE;
CREATE INDEX idx_notification_templates_name ON notification_templates(name);

CREATE INDEX idx_notification_rules_tenant_id ON notification_rules(tenant_id);
CREATE INDEX idx_notification_rules_events ON notification_rules USING GIN (event_types);
CREATE INDEX idx_notification_rules_active ON notification_rules(tenant_id, is_active) WHERE is_active = TRUE;

CREATE INDEX idx_notification_history_tenant_id ON notification_history(tenant_id);
CREATE INDEX idx_notification_history_rule_id ON notification_history(rule_id) WHERE rule_id IS NOT NULL;
CREATE INDEX idx_notification_history_channel_id ON notification_history(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_notification_history_event_type ON notification_history(event_type);
CREATE INDEX idx_notification_history_status ON notification_history(status);
CREATE INDEX idx_notification_history_created_at ON notification_history(created_at DESC);
CREATE INDEX idx_notification_history_retry ON notification_history(next_retry_at) WHERE next_retry_at IS NOT NULL;

CREATE INDEX idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_event_log_tenant_id ON event_log(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_event_log_user_id ON event_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_event_log_event_type ON event_log(event_type);
CREATE INDEX idx_event_log_event_date ON event_log(event_date);
CREATE INDEX idx_event_log_occurred_at ON event_log(occurred_at DESC);
CREATE INDEX idx_event_log_correlation ON event_log(correlation_id) WHERE correlation_id IS NOT NULL;

-- Enable RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY webhook_tenant_isolation ON webhooks FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY webhook_delivery_tenant_isolation ON webhook_deliveries FOR ALL TO authenticated 
USING (
    webhook_id IN (
        SELECT id FROM webhooks WHERE tenant_id = get_current_tenant_id()
    )
);

CREATE POLICY notification_channel_tenant_isolation ON notification_channels FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY notification_user_isolation ON notifications FOR ALL TO authenticated 
USING (user_id = auth.uid());

-- Create trigger to update webhook statistics
CREATE OR REPLACE FUNCTION update_webhook_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        IF NEW.status = 'delivered' THEN
            UPDATE webhooks 
            SET 
                total_deliveries = total_deliveries + 1,
                successful_deliveries = successful_deliveries + 1,
                last_delivery_at = NEW.delivered_at,
                average_response_time_ms = CASE 
                    WHEN total_deliveries = 0 THEN NEW.response_time_ms
                    ELSE (average_response_time_ms * total_deliveries + COALESCE(NEW.response_time_ms, 0)) / (total_deliveries + 1)
                END,
                updated_at = NOW()
            WHERE id = NEW.webhook_id;
        ELSIF NEW.status = 'failed' THEN
            UPDATE webhooks 
            SET 
                total_deliveries = total_deliveries + 1,
                failed_deliveries = failed_deliveries + 1,
                last_error = NEW.error_message,
                updated_at = NOW()
            WHERE id = NEW.webhook_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_webhook_stats
    AFTER UPDATE ON webhook_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_stats();

-- Function to emit events
CREATE OR REPLACE FUNCTION emit_event(
    p_event_type VARCHAR(100),
    p_event_name VARCHAR(255),
    p_event_data JSONB DEFAULT '{}',
    p_tenant_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_correlation_id VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO event_log (
        event_type,
        event_name,
        event_data,
        tenant_id,
        user_id,
        correlation_id
    ) VALUES (
        p_event_type,
        p_event_name,
        p_event_data,
        p_tenant_id,
        p_user_id,
        p_correlation_id
    ) RETURNING id INTO event_id;
    
    -- Trigger notification processing (this would be handled by the application)
    -- PERFORM pg_notify('event_emitted', json_build_object('event_id', event_id, 'event_type', p_event_type)::text);
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_title VARCHAR(500),
    p_message TEXT,
    p_type notification_type DEFAULT 'info',
    p_action_url TEXT DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        expires_at
    ) VALUES (
        p_user_id,
        p_title,
        p_message,
        p_type,
        p_action_url,
        p_expires_at
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
    p_user_id UUID,
    p_notification_ids UUID[] DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_notification_ids IS NOT NULL THEN
        -- Mark specific notifications as read
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
        WHERE user_id = p_user_id 
        AND id = ANY(p_notification_ids)
        AND is_read = FALSE;
    ELSE
        -- Mark all unread notifications as read
        UPDATE notifications 
        SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
        WHERE user_id = p_user_id 
        AND is_read = FALSE;
    END IF;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert this migration
INSERT INTO schema_migrations (version, checksum) 
VALUES ('009', md5('009_webhooks_notifications.sql'))
ON CONFLICT (version) DO NOTHING;