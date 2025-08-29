-- 008_monitoring_system.sql
-- Monitoring, analytics, and audit logging system

-- System health and metrics
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- counter, gauge, histogram, summary
    value DECIMAL(20,6) NOT NULL,
    unit VARCHAR(50),
    labels JSONB DEFAULT '{}',
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partition key for time-based partitioning
    metric_date DATE GENERATED ALWAYS AS (recorded_at::DATE) STORED
);

-- Audit logs for compliance and security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action details
    action audit_action NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    resource_name VARCHAR(500),
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255),
    session_id VARCHAR(255),
    
    -- Change details
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    
    -- Results
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Timing
    duration_ms INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Partition key
    audit_date DATE GENERATED ALWAYS AS (timestamp::DATE) STORED
);

-- Error tracking and reporting
CREATE TABLE error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Error details
    error_type VARCHAR(100) NOT NULL,
    error_code VARCHAR(100),
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    
    -- Context
    service_name VARCHAR(100),
    endpoint VARCHAR(500),
    method VARCHAR(10),
    request_id VARCHAR(255),
    correlation_id VARCHAR(255),
    
    -- Environment
    environment VARCHAR(50) DEFAULT 'production',
    version VARCHAR(50),
    
    -- Request details
    request_headers JSONB DEFAULT '{}',
    request_body JSONB,
    response_status INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags VARCHAR(100)[] DEFAULT '{}',
    
    -- Counts and resolution
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance monitoring
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Request details
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    
    -- Timing metrics (in milliseconds)
    response_time_ms INTEGER NOT NULL,
    db_query_time_ms INTEGER DEFAULT 0,
    external_api_time_ms INTEGER DEFAULT 0,
    cache_time_ms INTEGER DEFAULT 0,
    
    -- Resource usage
    memory_usage_mb DECIMAL(10,2),
    cpu_usage_percent DECIMAL(5,2),
    
    -- Request metadata
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    request_id VARCHAR(255),
    trace_id VARCHAR(255),
    
    -- Context
    service_name VARCHAR(100),
    version VARCHAR(50),
    environment VARCHAR(50) DEFAULT 'production',
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metric_date DATE GENERATED ALWAYS AS (recorded_at::DATE) STORED
);

-- Feature usage analytics
CREATE TABLE feature_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Feature details
    feature_name VARCHAR(255) NOT NULL,
    feature_category VARCHAR(100),
    action VARCHAR(100) NOT NULL, -- start, complete, cancel, error
    
    -- Context
    session_id VARCHAR(255),
    conversation_id UUID,
    tool_id UUID,
    artifact_id UUID,
    
    -- Metadata
    properties JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Timing
    duration_ms INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage and rate limiting
CREATE TABLE api_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    
    -- Request details
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    
    -- Rate limiting
    rate_limit_key VARCHAR(255),
    requests_count INTEGER DEFAULT 1,
    rate_limit_exceeded BOOLEAN DEFAULT FALSE,
    
    -- Request/response sizes
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    
    -- Timing
    response_time_ms INTEGER,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    referer TEXT,
    request_id VARCHAR(255),
    
    -- Cost tracking
    cost_cents INTEGER DEFAULT 0,
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    log_date DATE GENERATED ALWAYS AS (recorded_at::DATE) STORED
);

-- System alerts and notifications
CREATE TABLE system_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(100) NOT NULL, -- error_rate, response_time, resource_usage, security
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Alert conditions
    metric_name VARCHAR(255),
    threshold_value DECIMAL(20,6),
    current_value DECIMAL(20,6),
    condition_operator VARCHAR(10), -- gt, lt, eq, ne
    
    -- Scope
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    service_name VARCHAR(100),
    environment VARCHAR(50),
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, acknowledged, resolved, suppressed
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    
    -- Notification
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_channels VARCHAR(100)[] DEFAULT '{}',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    tags VARCHAR(100)[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Health check results
CREATE TABLE health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    check_name VARCHAR(255) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- healthy, unhealthy, warning
    
    -- Check details
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Environment
    environment VARCHAR(50) DEFAULT 'production',
    version VARCHAR(50),
    hostname VARCHAR(255),
    
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Database query performance tracking
CREATE TABLE query_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Query identification
    query_hash VARCHAR(64) NOT NULL, -- MD5 hash of normalized query
    query_text TEXT NOT NULL,
    query_type VARCHAR(50), -- SELECT, INSERT, UPDATE, DELETE
    
    -- Performance metrics
    execution_time_ms DECIMAL(10,3) NOT NULL,
    rows_examined BIGINT,
    rows_returned BIGINT,
    bytes_sent BIGINT,
    
    -- Context
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    database_name VARCHAR(100),
    table_name VARCHAR(100),
    
    -- Request context
    request_id VARCHAR(255),
    endpoint VARCHAR(500),
    
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    query_date DATE GENERATED ALWAYS AS (executed_at::DATE) STORED
);

-- Slow query log
CREATE TABLE slow_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    
    -- Performance details
    execution_time_ms DECIMAL(10,3) NOT NULL,
    lock_time_ms DECIMAL(10,3) DEFAULT 0,
    rows_examined BIGINT,
    rows_sent BIGINT,
    
    -- Frequency tracking
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optimization status
    optimized BOOLEAN DEFAULT FALSE,
    optimization_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_system_metrics_name_date ON system_metrics(metric_name, metric_date DESC);
CREATE INDEX idx_system_metrics_tenant_date ON system_metrics(tenant_id, metric_date DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_system_metrics_recorded_at ON system_metrics(recorded_at DESC);

CREATE INDEX idx_audit_logs_tenant_date ON audit_logs(tenant_id, audit_date DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

CREATE INDEX idx_error_logs_tenant_id ON error_logs(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_error_logs_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_service ON error_logs(service_name);
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved_at) WHERE resolved_at IS NOT NULL;

CREATE INDEX idx_performance_metrics_endpoint ON performance_metrics(endpoint);
CREATE INDEX idx_performance_metrics_tenant_date ON performance_metrics(tenant_id, metric_date DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_performance_metrics_response_time ON performance_metrics(response_time_ms DESC);
CREATE INDEX idx_performance_metrics_recorded_at ON performance_metrics(recorded_at DESC);

CREATE INDEX idx_feature_usage_tenant_id ON feature_usage(tenant_id);
CREATE INDEX idx_feature_usage_feature ON feature_usage(feature_name, action);
CREATE INDEX idx_feature_usage_user_id ON feature_usage(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_feature_usage_recorded_at ON feature_usage(recorded_at DESC);

CREATE INDEX idx_api_usage_logs_tenant_date ON api_usage_logs(tenant_id, log_date DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_api_usage_logs_endpoint ON api_usage_logs(endpoint);
CREATE INDEX idx_api_usage_logs_api_key ON api_usage_logs(api_key_id) WHERE api_key_id IS NOT NULL;
CREATE INDEX idx_api_usage_logs_rate_limit ON api_usage_logs(rate_limit_key, recorded_at DESC) WHERE rate_limit_key IS NOT NULL;

CREATE INDEX idx_system_alerts_status ON system_alerts(status);
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX idx_system_alerts_tenant_id ON system_alerts(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_system_alerts_created_at ON system_alerts(created_at DESC);

CREATE INDEX idx_health_checks_service ON health_checks(service_name, status);
CREATE INDEX idx_health_checks_status ON health_checks(status);
CREATE INDEX idx_health_checks_checked_at ON health_checks(checked_at DESC);

CREATE INDEX idx_query_performance_hash ON query_performance(query_hash);
CREATE INDEX idx_query_performance_tenant_date ON query_performance(tenant_id, query_date DESC) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_query_performance_execution_time ON query_performance(execution_time_ms DESC);
CREATE INDEX idx_query_performance_executed_at ON query_performance(executed_at DESC);

CREATE INDEX idx_slow_queries_hash ON slow_queries(query_hash);
CREATE INDEX idx_slow_queries_execution_time ON slow_queries(execution_time_ms DESC);
CREATE INDEX idx_slow_queries_occurrence ON slow_queries(occurrence_count DESC);
CREATE INDEX idx_slow_queries_optimized ON slow_queries(optimized);

-- Enable RLS where applicable
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY audit_log_tenant_isolation ON audit_logs FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

CREATE POLICY feature_usage_tenant_isolation ON feature_usage FOR ALL TO authenticated 
USING (tenant_id = get_current_tenant_id());

-- Create aggregation functions
CREATE OR REPLACE FUNCTION get_system_health_summary()
RETURNS TABLE (
    service_name VARCHAR(100),
    healthy_checks INTEGER,
    total_checks INTEGER,
    avg_response_time_ms DECIMAL,
    last_check_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hc.service_name,
        COUNT(CASE WHEN hc.status = 'healthy' THEN 1 END)::INTEGER as healthy_checks,
        COUNT(*)::INTEGER as total_checks,
        AVG(hc.response_time_ms) as avg_response_time_ms,
        MAX(hc.checked_at) as last_check_time
    FROM health_checks hc
    WHERE hc.checked_at > NOW() - INTERVAL '5 minutes'
    GROUP BY hc.service_name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to record feature usage
CREATE OR REPLACE FUNCTION record_feature_usage(
    p_tenant_id UUID,
    p_user_id UUID,
    p_feature_name VARCHAR(255),
    p_action VARCHAR(100),
    p_properties JSONB DEFAULT '{}',
    p_session_id VARCHAR(255) DEFAULT NULL,
    p_duration_ms INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    usage_id UUID;
BEGIN
    INSERT INTO feature_usage (
        tenant_id,
        user_id,
        feature_name,
        action,
        properties,
        session_id,
        duration_ms
    ) VALUES (
        p_tenant_id,
        p_user_id,
        p_feature_name,
        p_action,
        p_properties,
        p_session_id,
        p_duration_ms
    ) RETURNING id INTO usage_id;
    
    RETURN usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update error occurrence count
CREATE OR REPLACE FUNCTION update_error_occurrence()
RETURNS TRIGGER AS $$
BEGIN
    -- Try to find existing error with same type and message
    UPDATE error_logs 
    SET 
        occurrence_count = occurrence_count + 1,
        last_seen_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE error_type = NEW.error_type
    AND error_message = NEW.error_message
    AND service_name = COALESCE(NEW.service_name, service_name)
    AND tenant_id = COALESCE(NEW.tenant_id, tenant_id)
    AND created_at > NOW() - INTERVAL '1 hour'
    AND id != NEW.id;
    
    IF FOUND THEN
        -- Delete the new duplicate record
        DELETE FROM error_logs WHERE id = NEW.id;
        RETURN NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_error_occurrence
    AFTER INSERT ON error_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_error_occurrence();

-- Function to aggregate slow queries
CREATE OR REPLACE FUNCTION aggregate_slow_query()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO slow_queries (
        query_hash,
        query_text,
        execution_time_ms,
        lock_time_ms,
        rows_examined,
        rows_sent,
        occurrence_count,
        first_seen_at,
        last_seen_at
    ) VALUES (
        NEW.query_hash,
        NEW.query_text,
        NEW.execution_time_ms,
        0, -- lock_time_ms not available from performance tracking
        COALESCE(NEW.rows_examined, 0),
        COALESCE(NEW.rows_returned, 0),
        1,
        NEW.executed_at,
        NEW.executed_at
    )
    ON CONFLICT (query_hash) 
    DO UPDATE SET
        occurrence_count = slow_queries.occurrence_count + 1,
        last_seen_at = NEW.executed_at,
        execution_time_ms = CASE 
            WHEN NEW.execution_time_ms > slow_queries.execution_time_ms 
            THEN NEW.execution_time_ms 
            ELSE slow_queries.execution_time_ms 
        END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only track queries slower than 1 second
CREATE TRIGGER trigger_aggregate_slow_query
    AFTER INSERT ON query_performance
    FOR EACH ROW
    WHEN (NEW.execution_time_ms > 1000)
    EXECUTE FUNCTION aggregate_slow_query();

-- Insert this migration
INSERT INTO schema_migrations (version, checksum) 
VALUES ('008', md5('008_monitoring_system.sql'))
ON CONFLICT (version) DO NOTHING;