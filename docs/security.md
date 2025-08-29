# Security Guide

PENNY implements multiple layers of security to protect your data and ensure compliance with
enterprise standards.

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────┐
│                   WAF / DDoS Protection              │
├─────────────────────────────────────────────────────┤
│                   Load Balancer (TLS)                │
├─────────────────────────────────────────────────────┤
│                   API Gateway                        │
│         (Rate Limiting, Authentication)              │
├─────────────────────────────────────────────────────┤
│                 Application Layer                    │
│      (Authorization, Input Validation, CSRF)         │
├─────────────────────────────────────────────────────┤
│                  Data Layer                          │
│    (Encryption at Rest, Row Level Security)          │
└─────────────────────────────────────────────────────┘
```

## Authentication

### JWT Implementation

```typescript
// Token generation
const token = jwt.sign(
  {
    userId: user.id,
    tenantId: user.tenantId,
    roles: user.roles,
    sessionId: generateId('session'),
  },
  process.env.JWT_SECRET,
  {
    expiresIn: '24h',
    issuer: 'penny.ai',
    audience: 'penny-api',
  },
);
```

### Multi-Factor Authentication (MFA)

PENNY supports TOTP-based MFA:

```typescript
// Enable MFA
import { authenticator } from 'otplib';

const secret = authenticator.generateSecret();
const qrCode = authenticator.keyuri(user.email, 'PENNY', secret);

// Verify MFA token
const isValid = authenticator.verify({
  token: userToken,
  secret: user.mfaSecret,
});
```

### Session Management

```typescript
// Session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS only
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict',
  },
};
```

## Authorization

### Role-Based Access Control (RBAC)

```typescript
// Permission matrix
const permissions = {
  admin: ['*'],
  owner: ['tenant:*', 'user:*', 'workspace:*', 'billing:*'],
  member: ['conversation:*', 'message:*', 'file:upload', 'tool:execute'],
  viewer: ['conversation:read', 'message:read', 'file:read'],
};

// Authorization middleware
function authorize(resource: string, action: string) {
  return (req, res, next) => {
    const userPermissions = getUserPermissions(req.user);
    const required = `${resource}:${action}`;

    if (canAccess(userPermissions, required)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  };
}
```

### Multi-tenant Isolation

```sql
-- Row Level Security
CREATE POLICY tenant_isolation_policy ON ALL TABLES
FOR ALL
USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Automatic tenant filtering
CREATE OR REPLACE FUNCTION set_current_tenant(tenant_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant', tenant_id::text, true);
END;
$$ LANGUAGE plpgsql;
```

## Data Protection

### Encryption at Rest

```typescript
// AES-256-GCM encryption
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class EncryptionService {
  private algorithm = 'aes-256-gcm';

  async encrypt(plaintext: string, tenantId: string): Promise<string> {
    const key = await this.getTenantKey(tenantId);
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      encrypted,
      authTag: authTag.toString('hex'),
      iv: iv.toString('hex'),
    });
  }

  async decrypt(ciphertext: string, tenantId: string): Promise<string> {
    const { encrypted, authTag, iv } = JSON.parse(ciphertext);
    const key = await this.getTenantKey(tenantId);

    const decipher = createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### Key Management

```typescript
// Hierarchical key derivation
class KeyManagementService {
  private masterKey: Buffer;

  constructor() {
    this.masterKey = Buffer.from(process.env.MASTER_KEY, 'hex');
  }

  deriveKey(tenantId: string, purpose: string): Buffer {
    const salt = Buffer.concat([Buffer.from(tenantId), Buffer.from(purpose)]);

    return crypto.pbkdf2Sync(this.masterKey, salt, 100000, 32, 'sha256');
  }

  rotateKeys(tenantId: string): void {
    // Re-encrypt all tenant data with new key
    // Update key version in metadata
  }
}
```

## Input Validation

### Schema Validation

```typescript
// Zod schemas for validation
import { z } from 'zod';

const messageSchema = z.object({
  content: z
    .string()
    .min(1)
    .max(10000)
    .refine((content) => !containsSQLInjection(content)),
  conversationId: z.string().uuid(),
  artifacts: z
    .array(
      z.object({
        type: z.enum(['code', 'image', 'document']),
        content: z.string(),
      }),
    )
    .optional(),
});

// Validation middleware
function validate(schema: z.ZodSchema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
  };
}
```

### SQL Injection Prevention

```typescript
// Always use parameterized queries
const user = await prisma.user.findFirst({
  where: {
    email: userInput, // Safe - Prisma handles parameterization
    tenantId: context.tenantId,
  },
});

// Never use string interpolation
// BAD: `SELECT * FROM users WHERE email = '${userInput}'`
// GOOD: Use Prisma or parameterized queries
```

### XSS Prevention

```typescript
// Content Security Policy
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }),
);

// Sanitize user input
import DOMPurify from 'isomorphic-dompurify';

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  });
}
```

## API Security

### Rate Limiting

```typescript
// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    // Different limits based on plan
    const plan = req.user?.plan || 'free';
    return {
      free: 20,
      starter: 60,
      pro: 200,
      enterprise: 1000,
    }[plan];
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});
```

### API Key Management

```typescript
// API key generation
function generateApiKey(): string {
  const prefix = 'pk_live_';
  const key = crypto.randomBytes(32).toString('base64url');
  return prefix + key;
}

// API key validation
async function validateApiKey(apiKey: string): Promise<ApiKeyInfo> {
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

  const keyInfo = await prisma.apiKey.findUnique({
    where: { hashedKey },
    include: { tenant: true },
  });

  if (!keyInfo || keyInfo.revokedAt) {
    throw new Error('Invalid API key');
  }

  // Update last used
  await prisma.apiKey.update({
    where: { id: keyInfo.id },
    data: { lastUsedAt: new Date() },
  });

  return keyInfo;
}
```

## File Upload Security

### File Validation

```typescript
// File upload security
const fileUploadConfig = {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    // Allowed MIME types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/json',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
};

// Virus scanning
async function scanFile(buffer: Buffer): Promise<boolean> {
  // Integration with ClamAV or similar
  const result = await clamav.scanBuffer(buffer);
  return result.isInfected;
}
```

### Secure File Storage

```typescript
// Generate secure file paths
function generateSecureFilePath(tenantId: string, userId: string, filename: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(16).toString('hex');
  const ext = path.extname(filename);

  return `${tenantId}/${year}/${month}/${userId}/${random}${ext}`;
}

// Signed URLs for secure access
function generateSignedUrl(key: string, expiresIn: number = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = crypto
    .createHmac('sha256', process.env.URL_SIGNING_KEY)
    .update(`${key}:${expires}`)
    .digest('hex');

  return `${baseUrl}/files/${key}?expires=${expires}&signature=${signature}`;
}
```

## Audit Logging

### Comprehensive Audit Trail

```typescript
// Audit log schema
interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// Audit logging middleware
function auditLog(action: string, resource: string) {
  return async (req, res, next) => {
    const startTime = Date.now();

    // Capture original send
    const originalSend = res.send;

    res.send = function (data) {
      res.send = originalSend;

      // Log the action
      prisma.auditLog
        .create({
          data: {
            tenantId: req.user.tenantId,
            userId: req.user.id,
            action,
            resource,
            resourceId: req.params.id || null,
            metadata: {
              method: req.method,
              path: req.path,
              query: req.query,
              duration: Date.now() - startTime,
              statusCode: res.statusCode,
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        })
        .catch(console.error);

      return res.send(data);
    };

    next();
  };
}
```

## Compliance

### GDPR Compliance

```typescript
// Data export
async function exportUserData(userId: string): Promise<Buffer> {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      conversations: {
        include: { messages: true },
      },
      files: true,
      auditLogs: true,
    },
  });

  return Buffer.from(JSON.stringify(userData, null, 2));
}

// Data deletion
async function deleteUserData(userId: string): Promise<void> {
  await prisma.$transaction([
    // Anonymize messages
    prisma.message.updateMany({
      where: { userId },
      data: {
        content: '[DELETED]',
        userId: null,
      },
    }),

    // Delete files
    prisma.file.deleteMany({
      where: { userId },
    }),

    // Delete user
    prisma.user.delete({
      where: { id: userId },
    }),
  ]);
}
```

### SOC 2 Controls

1. **Access Control**
   - MFA enforcement
   - Regular access reviews
   - Principle of least privilege

2. **Change Management**
   - Code review requirements
   - Automated testing
   - Deployment approvals

3. **Incident Response**
   ```typescript
   // Incident detection
   if (failedLoginAttempts > 5) {
     await notifySecurityTeam({
       type: 'SUSPICIOUS_ACTIVITY',
       userId,
       details: 'Multiple failed login attempts',
     });
   }
   ```

## Security Headers

```typescript
// Security headers configuration
app.use((req, res, next) => {
  // HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
});
```

## Security Monitoring

### Real-time Threat Detection

```typescript
// Anomaly detection
class SecurityMonitor {
  async detectAnomalies(userId: string, action: string) {
    const recentActions = await this.getRecentActions(userId);

    // Check for unusual patterns
    if (this.isUnusualLocation(recentActions)) {
      await this.flagSuspiciousActivity(userId, 'location_anomaly');
    }

    if (this.isUnusualTime(recentActions)) {
      await this.flagSuspiciousActivity(userId, 'time_anomaly');
    }

    if (this.isHighVelocity(recentActions)) {
      await this.flagSuspiciousActivity(userId, 'high_velocity');
    }
  }
}
```

### Security Alerts

```typescript
// Alert configuration
const securityAlerts = {
  suspiciousLogin: {
    threshold: 5,
    window: 300, // 5 minutes
    action: 'BLOCK_IP',
  },
  dataExfiltration: {
    threshold: 1000, // requests
    window: 3600, // 1 hour
    action: 'SUSPEND_USER',
  },
  privilegeEscalation: {
    threshold: 1,
    window: 0,
    action: 'IMMEDIATE_ALERT',
  },
};
```

## Best Practices

### Development Security

1. **Dependency Management**

   ```bash
   # Regular security audits
   npm audit
   npm audit fix

   # Use Snyk for continuous monitoring
   snyk monitor
   ```

2. **Secret Management**

   ```typescript
   // Never commit secrets
   // Use environment variables
   // Rotate secrets regularly
   // Use secret management services (AWS Secrets Manager, HashiCorp Vault)
   ```

3. **Code Security**
   ```typescript
   // Use TypeScript for type safety
   // Enable strict mode
   // Use ESLint security plugin
   // Regular SAST scans
   ```

### Operational Security

1. **Access Control**
   - Use SSO for admin access
   - Enforce MFA for all admin accounts
   - Regular access reviews
   - Audit trail for all admin actions

2. **Network Security**
   - Use VPN for admin access
   - Whitelist IP addresses
   - Network segmentation
   - Regular penetration testing

3. **Incident Response**
   - Documented response procedures
   - Regular drills
   - Post-incident reviews
   - Continuous improvement
