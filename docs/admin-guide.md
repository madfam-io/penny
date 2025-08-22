# Admin Guide

This guide covers administration and management of the PENNY platform.

## Admin Dashboard Overview

The PENNY Admin Dashboard provides centralized management for:
- Tenant organizations
- User accounts and permissions
- Billing and subscriptions
- System monitoring
- Security settings
- Platform configuration

Access the admin dashboard at: `https://admin.penny.ai`

## Tenant Management

### Creating a New Tenant

1. Navigate to **Tenants** in the admin dashboard
2. Click **Create Tenant**
3. Fill in the required information:
   - **Organization Name**: Company or organization name
   - **URL Slug**: Unique identifier for URLs (e.g., `acme-corp`)
   - **Subscription Plan**: Select appropriate plan
   - **Admin Email**: Primary administrator email
   - **Admin Name**: Administrator's full name

### Tenant Configuration

Each tenant can be configured with:

```json
{
  "features": {
    "enabledModels": ["gpt-4", "claude-3", "gemini-pro"],
    "enabledTools": ["*"], // Or specific tools
    "maxUsers": 100,
    "maxWorkspaces": 10,
    "maxStorageGB": 100
  },
  "security": {
    "requireMFA": true,
    "allowedDomains": ["@acme.com"],
    "ipWhitelist": ["192.168.1.0/24"],
    "sessionTimeout": 86400
  },
  "integrations": {
    "sso": {
      "enabled": true,
      "provider": "okta",
      "config": {...}
    }
  }
}
```

### Managing Tenant Plans

To change a tenant's subscription:

1. Go to **Tenants** → Select tenant
2. Click **Subscription** tab
3. Select new plan
4. Review changes and confirm

Plan limits are automatically enforced:

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| Users | 5 | 20 | 100 | Unlimited |
| AI Requests/day | 100 | 1,000 | 10,000 | Unlimited |
| Storage | 1 GB | 10 GB | 100 GB | Custom |
| Support | Community | Email | Priority | Dedicated |

## User Management

### User Roles and Permissions

PENNY supports four user roles:

1. **Owner**
   - Full tenant administration
   - Billing management
   - User management
   - All member permissions

2. **Admin**
   - User management
   - Workspace management
   - Integration configuration
   - All member permissions

3. **Member**
   - Create/edit conversations
   - Use AI features
   - Upload files
   - Execute tools

4. **Viewer**
   - Read-only access
   - View conversations
   - Download files

### Inviting Users

#### Single User Invitation
1. Navigate to **Users** → **Invite User**
2. Enter email and optional details
3. Select tenant and role
4. Optionally add to specific workspaces
5. Send invitation

#### Bulk User Import
1. Download the CSV template
2. Fill in user details:
   ```csv
   email,name,role,workspace
   john@acme.com,John Doe,member,engineering
   jane@acme.com,Jane Smith,admin,
   ```
3. Upload CSV file
4. Review and confirm import

### Managing User Access

#### Suspend a User
```bash
# Via UI
Users → Select user → Actions → Suspend

# Via API
PATCH /api/v1/admin/users/{userId}
{
  "status": "suspended"
}
```

#### Reset User Password
1. Go to **Users** → Select user
2. Click **Reset Password**
3. User receives password reset email

#### Enforce MFA
```javascript
// Global enforcement
await prisma.tenant.update({
  where: { id: tenantId },
  data: {
    settings: {
      security: {
        requireMFA: true
      }
    }
  }
});
```

## Billing Administration

### Subscription Management

#### View Current Subscriptions
Navigate to **Billing** → **Subscriptions** to see:
- Active subscriptions
- Payment status
- Usage metrics
- Renewal dates

#### Manual Billing Operations

1. **Apply Credits**
   ```bash
   Billing → Tenant → Add Credit
   Amount: $100
   Reason: "Service credit for downtime"
   ```

2. **Generate Invoice**
   ```bash
   Billing → Invoices → Create Manual Invoice
   ```

3. **Process Refund**
   ```bash
   Billing → Payments → Select payment → Refund
   ```

### Usage Monitoring

Monitor usage across tenants:

```sql
-- Top consumers by AI tokens
SELECT 
  t.name,
  SUM(um.value) as total_tokens,
  COUNT(DISTINCT um.user_id) as active_users
FROM usage_metrics um
JOIN tenants t ON um.tenant_id = t.id
WHERE um.metric = 'ai_tokens'
  AND um.created_at > NOW() - INTERVAL '30 days'
GROUP BY t.id
ORDER BY total_tokens DESC
LIMIT 10;
```

### Cost Management

Set up usage alerts:

```typescript
// Configure alerts
const usageAlerts = {
  aiTokens: {
    threshold: 0.8, // 80% of limit
    action: 'EMAIL_ADMIN',
  },
  storage: {
    threshold: 0.9, // 90% of limit
    action: 'BLOCK_UPLOADS',
  },
  apiRequests: {
    threshold: 0.95, // 95% of limit
    action: 'THROTTLE_REQUESTS',
  },
};
```

## System Monitoring

### Health Monitoring

The health dashboard shows:
- Service status (API, Database, Redis, AI Services)
- Response times
- Error rates
- Active incidents

#### Creating Health Checks

```typescript
// Custom health check
app.get('/health/custom', async (req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkAIProviders(),
    checkStorage(),
  ]);
  
  res.json({
    status: checks.every(c => c.healthy) ? 'healthy' : 'degraded',
    services: checks,
  });
});
```

### Performance Metrics

Key metrics to monitor:

1. **API Performance**
   - Request latency (p50, p95, p99)
   - Throughput (requests/second)
   - Error rate
   - Queue depth

2. **AI Model Performance**
   - Token usage by model
   - Average response time
   - Cost per request
   - Error rates by provider

3. **Database Performance**
   - Query execution time
   - Connection pool usage
   - Lock waits
   - Replication lag

### Alert Configuration

Set up alerts in the monitoring system:

```yaml
# alerts.yml
alerts:
  - name: HighErrorRate
    condition: error_rate > 0.05
    duration: 5m
    severity: warning
    notify:
      - email: ops@penny.ai
      - slack: #alerts
      
  - name: DatabaseConnectionPool
    condition: connection_pool_usage > 0.9
    duration: 2m
    severity: critical
    notify:
      - pagerduty: database-team
```

## Security Administration

### Security Settings

#### Global Security Configuration

```typescript
// Configure security settings
const securityConfig = {
  authentication: {
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true,
      preventReuse: 5,
    },
    sessionTimeout: 24 * 60 * 60, // 24 hours
    maxSessions: 5,
  },
  mfa: {
    required: true,
    allowedMethods: ['totp', 'sms'],
  },
  ipRestrictions: {
    enabled: true,
    whitelist: ['10.0.0.0/8'],
  },
};
```

#### Audit Log Review

Access audit logs:

1. Navigate to **Security** → **Audit Logs**
2. Filter by:
   - Date range
   - User
   - Action type
   - Resource
3. Export for compliance

Common audit queries:

```sql
-- Failed login attempts
SELECT * FROM audit_logs
WHERE action = 'login_failed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Permission changes
SELECT * FROM audit_logs
WHERE action LIKE '%permission%'
  OR action LIKE '%role%'
ORDER BY created_at DESC;

-- Data exports
SELECT * FROM audit_logs
WHERE action IN ('export_data', 'download_bulk')
ORDER BY created_at DESC;
```

### Compliance Management

#### GDPR Compliance

Handle data requests:

1. **Data Export Request**
   ```bash
   Users → Select user → Actions → Export Data
   ```
   
2. **Right to be Forgotten**
   ```bash
   Users → Select user → Actions → Delete User
   # Confirm with "DELETE {email}"
   ```

#### Compliance Reports

Generate compliance reports:

```typescript
// Monthly compliance report
async function generateComplianceReport() {
  return {
    period: 'monthly',
    metrics: {
      dataRequests: await getDataRequests(),
      deletionRequests: await getDeletionRequests(),
      securityIncidents: await getSecurityIncidents(),
      uptimePercentage: await getUptime(),
    },
    certifications: {
      soc2: 'compliant',
      gdpr: 'compliant',
      hipaa: 'not_applicable',
    },
  };
}
```

## Platform Configuration

### Feature Flags

Manage feature rollouts:

```typescript
// Feature flag configuration
const features = {
  newAIModel: {
    enabled: true,
    rolloutPercentage: 50,
    enabledTenants: ['tenant_123', 'tenant_456'],
  },
  advancedTools: {
    enabled: true,
    requiredPlan: 'pro',
  },
  betaFeatures: {
    enabled: false,
    whitelist: ['beta_tester@example.com'],
  },
};
```

### Integration Management

Configure third-party integrations:

1. **SSO Configuration**
   ```bash
   Settings → Integrations → SSO
   - Provider: Okta/Auth0/Azure AD
   - Client ID: xxx
   - Client Secret: xxx
   - Redirect URL: https://penny.ai/auth/callback
   ```

2. **Webhook Configuration**
   ```bash
   Settings → Integrations → Webhooks
   - URL: https://your-endpoint.com/webhook
   - Events: [user.created, conversation.created]
   - Secret: xxx
   ```

### Email Templates

Customize system emails:

```handlebars
<!-- welcome.hbs -->
<h1>Welcome to PENNY, {{user.name}}!</h1>
<p>Your account has been created for {{tenant.name}}.</p>
<a href="{{loginUrl}}">Get Started</a>
```

## Maintenance Operations

### Database Maintenance

#### Backup Management
```bash
# Manual backup
npm run db:backup -- --tenant=all

# Restore specific tenant
npm run db:restore -- --tenant=tenant_123 --backup=backup_20240220.sql
```

#### Performance Optimization
```sql
-- Vacuum and analyze
VACUUM ANALYZE conversations;
VACUUM ANALYZE messages;

-- Reindex
REINDEX TABLE conversations;
REINDEX TABLE messages;
```

### Cache Management

Clear caches when needed:

```typescript
// Clear all caches
await redis.flushall();

// Clear specific cache
await redis.del('cache:models:*');
await redis.del('cache:tenants:*');
```

### Deployment Management

#### Rolling Updates
```bash
# Update API servers
kubectl set image deployment/api api=penny/api:v2.1.0 -n penny

# Monitor rollout
kubectl rollout status deployment/api -n penny
```

#### Maintenance Mode
```typescript
// Enable maintenance mode
await redis.set('maintenance_mode', 'true');
await redis.set('maintenance_message', 'Scheduled maintenance in progress');

// Disable maintenance mode
await redis.del('maintenance_mode');
await redis.del('maintenance_message');
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check for memory leaks
   - Increase Node.js heap size
   - Scale horizontally

2. **Slow Queries**
   - Check query performance
   - Add missing indexes
   - Optimize query patterns

3. **Authentication Issues**
   - Verify JWT secret
   - Check token expiration
   - Review session configuration

### Debug Mode

Enable debug logging:

```bash
# Environment variables
DEBUG=penny:*
LOG_LEVEL=debug

# Runtime toggle
await redis.set('debug:user:user_123', 'true');
```

### Support Tools

```bash
# User impersonation (for support)
npm run admin:impersonate -- --user=user@example.com

# Generate support bundle
npm run admin:support-bundle -- --tenant=tenant_123

# Database query tool
npm run admin:query -- --sql="SELECT * FROM users LIMIT 10"
```