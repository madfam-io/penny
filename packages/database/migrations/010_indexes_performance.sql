-- 010_indexes_performance.sql
-- Performance optimization indexes, views, and database functions

-- Create additional composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_status_email 
ON users(tenant_id, status, email) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_updated_at 
ON conversations(user_id, updated_at DESC) 
WHERE is_archived = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created_at 
ON messages(conversation_id, created_at DESC) 
WHERE is_deleted = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_tenant_type_public 
ON artifacts(tenant_id, type, is_public) 
WHERE processing_status = 'completed';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_category_enabled_executions 
ON tools(category, is_enabled, total_executions DESC) 
WHERE is_enabled = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_executions_status_started 
ON tool_executions(status, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_period_end 
ON subscriptions(status, current_period_end) 
WHERE status IN ('active', 'trialing');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant_status_due 
ON invoices(tenant_id, status, due_date) 
WHERE status IN ('open', 'past_due');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_action_timestamp 
ON audit_logs(tenant_id, action, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhooks_tenant_active_events 
ON webhooks(tenant_id, is_active) USING GIN(events) 
WHERE is_active = TRUE;

-- Create partial indexes for frequently filtered data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active_expires 
ON sessions(expires) 
WHERE is_active = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_active_tenant 
ON api_keys(tenant_id, last_used_at DESC) 
WHERE expires_at IS NULL OR expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread_created 
ON notifications(user_id, created_at DESC) 
WHERE is_read = FALSE AND (expires_at IS NULL OR expires_at > NOW());

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_title_search 
ON conversations USING gin(to_tsvector('english', title)) 
WHERE title IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_content_search 
ON messages USING gin(to_tsvector('english', content)) 
WHERE role = 'user' AND is_deleted = FALSE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_name_description_search 
ON artifacts USING gin(
    to_tsvector('english', 
        COALESCE(name, '') || ' ' || COALESCE(description, '')
    )
);

-- JSONB indexes for metadata searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_settings_gin 
ON tenants USING gin(settings);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preferences_gin 
ON users USING gin(preferences);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_config_gin 
ON tools USING gin(config);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_metadata_gin 
ON artifacts USING gin(metadata);

-- Create materialized views for analytics and reporting
CREATE MATERIALIZED VIEW IF NOT EXISTS tenant_analytics AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.created_at as tenant_created_at,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT u.id) FILTER (WHERE u.last_active_at > NOW() - INTERVAL '30 days') as active_users_30d,
    COUNT(DISTINCT c.id) as total_conversations,
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '30 days') as conversations_30d,
    COUNT(DISTINCT m.id) as total_messages,
    COUNT(DISTINCT m.id) FILTER (WHERE m.created_at > NOW() - INTERVAL '30 days') as messages_30d,
    COUNT(DISTINCT a.id) as total_artifacts,
    COUNT(DISTINCT te.id) as total_tool_executions,
    COUNT(DISTINCT te.id) FILTER (WHERE te.started_at > NOW() - INTERVAL '30 days') as tool_executions_30d,
    COALESCE(s.status, 'none') as subscription_status,
    COALESCE(sp.name, 'No Plan') as subscription_plan
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id AND u.status = 'active'
LEFT JOIN conversations c ON t.id = c.tenant_id
LEFT JOIN messages m ON c.id = m.conversation_id AND m.is_deleted = FALSE
LEFT JOIN artifacts a ON t.id = a.tenant_id
LEFT JOIN tool_executions te ON u.id = te.user_id
LEFT JOIN subscriptions s ON t.id = s.tenant_id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
GROUP BY t.id, t.name, t.created_at, s.status, sp.name;

CREATE UNIQUE INDEX ON tenant_analytics (tenant_id);

-- Tool usage analytics view
CREATE MATERIALIZED VIEW IF NOT EXISTS tool_usage_analytics AS
SELECT 
    t.id as tool_id,
    t.name as tool_name,
    t.category,
    t.is_system,
    COUNT(te.id) as total_executions,
    COUNT(te.id) FILTER (WHERE te.status = 'completed') as successful_executions,
    COUNT(te.id) FILTER (WHERE te.status = 'failed') as failed_executions,
    COUNT(DISTINCT te.user_id) as unique_users,
    COUNT(DISTINCT te.tenant_id) as unique_tenants,
    AVG(te.duration_ms) FILTER (WHERE te.duration_ms IS NOT NULL) as avg_duration_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY te.duration_ms) FILTER (WHERE te.duration_ms IS NOT NULL) as median_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY te.duration_ms) FILTER (WHERE te.duration_ms IS NOT NULL) as p95_duration_ms,
    COUNT(te.id) FILTER (WHERE te.started_at > NOW() - INTERVAL '24 hours') as executions_24h,
    COUNT(te.id) FILTER (WHERE te.started_at > NOW() - INTERVAL '7 days') as executions_7d,
    COUNT(te.id) FILTER (WHERE te.started_at > NOW() - INTERVAL '30 days') as executions_30d
FROM tools t
LEFT JOIN tool_executions te ON t.id = te.tool_id
GROUP BY t.id, t.name, t.category, t.is_system;

CREATE UNIQUE INDEX ON tool_usage_analytics (tool_id);

-- User activity analytics view
CREATE MATERIALIZED VIEW IF NOT EXISTS user_activity_analytics AS
SELECT 
    u.id as user_id,
    u.tenant_id,
    u.name as user_name,
    u.email,
    u.created_at as user_created_at,
    u.last_active_at,
    COUNT(DISTINCT c.id) as total_conversations,
    COUNT(DISTINCT m.id) as total_messages,
    COUNT(DISTINCT te.id) as total_tool_executions,
    COUNT(DISTINCT a.id) as total_artifacts,
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at > NOW() - INTERVAL '30 days') as conversations_30d,
    COUNT(DISTINCT m.id) FILTER (WHERE m.created_at > NOW() - INTERVAL '30 days') as messages_30d,
    COUNT(DISTINCT te.id) FILTER (WHERE te.started_at > NOW() - INTERVAL '30 days') as tool_executions_30d,
    COUNT(DISTINCT a.id) FILTER (WHERE a.created_at > NOW() - INTERVAL '30 days') as artifacts_30d,
    CASE 
        WHEN u.last_active_at > NOW() - INTERVAL '24 hours' THEN 'highly_active'
        WHEN u.last_active_at > NOW() - INTERVAL '7 days' THEN 'active'
        WHEN u.last_active_at > NOW() - INTERVAL '30 days' THEN 'moderate'
        ELSE 'inactive'
    END as activity_level
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id
LEFT JOIN messages m ON u.id = m.user_id AND m.is_deleted = FALSE
LEFT JOIN tool_executions te ON u.id = te.user_id
LEFT JOIN artifacts a ON u.id = a.user_id
WHERE u.status = 'active'
GROUP BY u.id, u.tenant_id, u.name, u.email, u.created_at, u.last_active_at;

CREATE UNIQUE INDEX ON user_activity_analytics (user_id);
CREATE INDEX ON user_activity_analytics (tenant_id, activity_level);

-- Performance monitoring view
CREATE MATERIALIZED VIEW IF NOT EXISTS performance_summary AS
SELECT 
    DATE_TRUNC('hour', pm.recorded_at) as time_bucket,
    pm.endpoint,
    pm.method,
    COUNT(*) as request_count,
    AVG(pm.response_time_ms) as avg_response_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pm.response_time_ms) as p50_response_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.response_time_ms) as p95_response_time_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pm.response_time_ms) as p99_response_time_ms,
    COUNT(*) FILTER (WHERE pm.status_code >= 200 AND pm.status_code < 300) as success_count,
    COUNT(*) FILTER (WHERE pm.status_code >= 400 AND pm.status_code < 500) as client_error_count,
    COUNT(*) FILTER (WHERE pm.status_code >= 500) as server_error_count,
    AVG(pm.db_query_time_ms) as avg_db_time_ms,
    AVG(pm.memory_usage_mb) as avg_memory_mb
FROM performance_metrics pm
WHERE pm.recorded_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', pm.recorded_at), pm.endpoint, pm.method;

CREATE INDEX ON performance_summary (time_bucket DESC, endpoint);

-- Create functions for common queries

-- Function to get tenant usage summary
CREATE OR REPLACE FUNCTION get_tenant_usage_summary(p_tenant_id UUID, p_period_days INTEGER DEFAULT 30)
RETURNS TABLE (
    metric_name TEXT,
    current_value BIGINT,
    previous_value BIGINT,
    change_percent DECIMAL
) AS $$
DECLARE
    period_start TIMESTAMP WITH TIME ZONE := NOW() - (p_period_days || ' days')::INTERVAL;
    previous_period_start TIMESTAMP WITH TIME ZONE := NOW() - (p_period_days * 2 || ' days')::INTERVAL;
BEGIN
    RETURN QUERY
    WITH current_metrics AS (
        SELECT 
            'conversations' as metric, COUNT(*)::BIGINT as value
        FROM conversations c
        WHERE c.tenant_id = p_tenant_id AND c.created_at >= period_start
        UNION ALL
        SELECT 
            'messages' as metric, COUNT(*)::BIGINT as value
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.tenant_id = p_tenant_id AND m.created_at >= period_start
        UNION ALL
        SELECT 
            'tool_executions' as metric, COUNT(*)::BIGINT as value
        FROM tool_executions te
        JOIN users u ON te.user_id = u.id
        WHERE u.tenant_id = p_tenant_id AND te.started_at >= period_start
        UNION ALL
        SELECT 
            'artifacts' as metric, COUNT(*)::BIGINT as value
        FROM artifacts a
        WHERE a.tenant_id = p_tenant_id AND a.created_at >= period_start
    ),
    previous_metrics AS (
        SELECT 
            'conversations' as metric, COUNT(*)::BIGINT as value
        FROM conversations c
        WHERE c.tenant_id = p_tenant_id 
        AND c.created_at >= previous_period_start 
        AND c.created_at < period_start
        UNION ALL
        SELECT 
            'messages' as metric, COUNT(*)::BIGINT as value
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.tenant_id = p_tenant_id 
        AND m.created_at >= previous_period_start 
        AND m.created_at < period_start
        UNION ALL
        SELECT 
            'tool_executions' as metric, COUNT(*)::BIGINT as value
        FROM tool_executions te
        JOIN users u ON te.user_id = u.id
        WHERE u.tenant_id = p_tenant_id 
        AND te.started_at >= previous_period_start 
        AND te.started_at < period_start
        UNION ALL
        SELECT 
            'artifacts' as metric, COUNT(*)::BIGINT as value
        FROM artifacts a
        WHERE a.tenant_id = p_tenant_id 
        AND a.created_at >= previous_period_start 
        AND a.created_at < period_start
    )
    SELECT 
        cm.metric,
        cm.value,
        COALESCE(pm.value, 0),
        CASE 
            WHEN COALESCE(pm.value, 0) = 0 THEN 
                CASE WHEN cm.value > 0 THEN 100.0 ELSE 0.0 END
            ELSE 
                ROUND(((cm.value - COALESCE(pm.value, 0))::DECIMAL / pm.value * 100), 2)
        END
    FROM current_metrics cm
    LEFT JOIN previous_metrics pm ON cm.metric = pm.metric;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get user conversation summary
CREATE OR REPLACE FUNCTION get_user_conversation_summary(p_user_id UUID)
RETURNS TABLE (
    total_conversations BIGINT,
    active_conversations BIGINT,
    total_messages BIGINT,
    avg_messages_per_conversation DECIMAL,
    most_recent_conversation TIMESTAMP WITH TIME ZONE,
    favorite_tools TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT c.id)::BIGINT,
        COUNT(DISTINCT c.id) FILTER (WHERE c.updated_at > NOW() - INTERVAL '7 days')::BIGINT,
        COUNT(DISTINCT m.id)::BIGINT,
        ROUND(COUNT(DISTINCT m.id)::DECIMAL / GREATEST(COUNT(DISTINCT c.id), 1), 2),
        MAX(c.updated_at),
        ARRAY(
            SELECT t.name
            FROM tool_executions te
            JOIN tools t ON te.tool_id = t.id
            WHERE te.user_id = p_user_id
            GROUP BY t.name
            ORDER BY COUNT(*) DESC
            LIMIT 5
        )
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id AND m.is_deleted = FALSE
    WHERE c.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY tool_usage_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_activity_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY performance_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to optimize database
CREATE OR REPLACE FUNCTION optimize_database()
RETURNS TABLE (
    table_name TEXT,
    action TEXT,
    result TEXT
) AS $$
DECLARE
    rec RECORD;
BEGIN
    -- Analyze all tables for better query planning
    FOR rec IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ANALYZE %I.%I', rec.schemaname, rec.tablename);
        RETURN QUERY SELECT rec.tablename, 'ANALYZE', 'Completed';
    END LOOP;
    
    -- Update table statistics
    RETURN QUERY SELECT 'ALL_TABLES', 'ANALYZE', 'Statistics updated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for database health check
CREATE OR REPLACE FUNCTION database_health_check()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    value TEXT,
    recommended_action TEXT
) AS $$
BEGIN
    -- Check database size
    RETURN QUERY
    SELECT 
        'database_size',
        CASE WHEN pg_database_size(current_database()) > 10 * 1024^3 THEN 'warning' ELSE 'ok' END,
        pg_size_pretty(pg_database_size(current_database())),
        CASE WHEN pg_database_size(current_database()) > 10 * 1024^3 THEN 'Consider archiving old data' ELSE 'No action needed' END;
    
    -- Check connection count
    RETURN QUERY
    SELECT 
        'active_connections',
        CASE WHEN COUNT(*) > 80 THEN 'warning' ELSE 'ok' END,
        COUNT(*)::TEXT,
        CASE WHEN COUNT(*) > 80 THEN 'Monitor connection pooling' ELSE 'No action needed' END
    FROM pg_stat_activity 
    WHERE state = 'active';
    
    -- Check for long running queries
    RETURN QUERY
    SELECT 
        'long_running_queries',
        CASE WHEN COUNT(*) > 0 THEN 'warning' ELSE 'ok' END,
        COUNT(*)::TEXT,
        CASE WHEN COUNT(*) > 0 THEN 'Investigate slow queries' ELSE 'No action needed' END
    FROM pg_stat_activity 
    WHERE state = 'active' 
    AND query_start < NOW() - INTERVAL '5 minutes'
    AND query != '<IDLE>';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create indexes for materialized view refresh
CREATE INDEX IF NOT EXISTS idx_conversations_created_at_tenant 
ON conversations(created_at, tenant_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at_user 
ON messages(created_at, user_id) 
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_tool_executions_started_at 
ON tool_executions(started_at, tool_id, status);

-- Insert this migration
INSERT INTO schema_migrations (version, checksum) 
VALUES ('010', md5('010_indexes_performance.sql'))
ON CONFLICT (version) DO NOTHING;