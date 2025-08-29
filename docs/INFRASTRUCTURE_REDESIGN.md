# PENNY Infrastructure Redesign: Vercel + Railway + Cloudflare

## Executive Summary

This document outlines the complete infrastructure redesign of the PENNY platform to leverage three cloud services: Vercel (frontend), Railway (backend), and Cloudflare (storage/CDN). This architecture provides optimal performance, cost-efficiency, and operational simplicity while maintaining all platform capabilities.

## Architecture Overview

```mermaid
graph TB
    subgraph "User Layer"
        USER[Users]
        ADMIN[Admins]
    end
    
    subgraph "Cloudflare"
        CDN[CDN/Edge]
        R2[R2 Object Storage]
        WORKERS[Workers]
        DNS[DNS]
    end
    
    subgraph "Vercel"
        WEB[Web App<br/>React SPA]
        ADMIN_APP[Admin Console<br/>Next.js]
        EDGE_FN[Edge Functions<br/>Auth/Proxy]
    end
    
    subgraph "Railway"
        API[API Service<br/>Fastify]
        WS[WebSocket Service]
        WORKER[Background Workers]
        SANDBOX[Python Sandbox]
        PG[(PostgreSQL<br/>+ pgvector)]
        REDIS[(Redis)]
    end
    
    USER --> CDN
    ADMIN --> CDN
    CDN --> WEB
    CDN --> ADMIN_APP
    WEB --> EDGE_FN
    ADMIN_APP --> EDGE_FN
    EDGE_FN --> API
    WEB --> WS
    API --> PG
    API --> REDIS
    API --> R2
    WORKER --> SANDBOX
    WORKER --> PG
    WORKER --> REDIS
    R2 --> CDN
```

## Service Distribution

### 1. Vercel (Frontend & Edge)

#### Services Deployed
- **Web Application** (`apps/web`)
  - React SPA for main chat interface
  - Artifact viewer components
  - Real-time chat UI
  
- **Admin Console** (`apps/admin`)
  - Next.js application
  - Server-side rendering
  - Admin dashboard and analytics

- **Edge Functions**
  - Authentication middleware
  - API request proxying
  - Rate limiting at edge
  - Geolocation routing

#### Configuration

```javascript
// vercel.json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://penny-api.railway.app/api/:path*"
    },
    {
      "source": "/ws",
      "destination": "https://penny-ws.railway.app/"
    }
  ],
  "functions": {
    "apps/web/api/auth.ts": {
      "runtime": "edge",
      "regions": ["iad1", "sfo1", "sin1"]
    }
  },
  "env": {
    "NEXT_PUBLIC_API_URL": "@railway_api_url",
    "NEXT_PUBLIC_WS_URL": "@railway_ws_url"
  }
}
```

### 2. Railway (Backend Services)

#### Services Deployed

##### API Service (`apps/api`)
```yaml
# railway.yaml - API Service
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    env:
      PORT: 3001
      DATABASE_URL: ${{Postgres.DATABASE_URL}}
      REDIS_URL: ${{Redis.REDIS_URL}}
      R2_ENDPOINT: ${{R2_ENDPOINT}}
      R2_ACCESS_KEY: ${{R2_ACCESS_KEY}}
    healthcheck:
      path: /health
      interval: 30s
```

##### WebSocket Service
```typescript
// apps/api/src/services/websocket.ts
export class WebSocketService {
  private server: Server;
  private redis: Redis;
  
  constructor() {
    this.server = new Server({
      cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true
      }
    });
    
    // Redis adapter for scaling
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    this.server.adapter(createAdapter(pubClient, subClient));
  }
  
  start(port: number) {
    this.server.listen(port);
  }
}
```

##### Background Workers
```typescript
// apps/api/src/workers/index.ts
import { Queue, Worker } from 'bullmq';

export const toolQueue = new Queue('tools', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
  }
});

export const toolWorker = new Worker('tools', async (job) => {
  const { tool, params, context } = job.data;
  
  switch (tool) {
    case 'python_execute':
      return await pythonSandbox.execute(params, context);
    case 'generate_report':
      return await reportGenerator.generate(params, context);
    default:
      return await toolExecutor.execute(tool, params, context);
  }
}, {
  connection: redis,
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000
  }
});
```

##### Python Sandbox Service
```dockerfile
# apps/sandbox/Dockerfile
FROM python:3.11-slim

# Install scientific packages
RUN pip install numpy pandas matplotlib scikit-learn

# Security restrictions
RUN useradd -m -s /bin/bash sandbox
USER sandbox

WORKDIR /workspace
COPY sandbox-runner.py .

CMD ["python", "sandbox-runner.py"]
```

##### Databases
```yaml
# PostgreSQL with pgvector
postgres:
  image: pgvector/pgvector:pg15
  env:
    POSTGRES_DB: penny
    POSTGRES_USER: ${{POSTGRES_USER}}
    POSTGRES_PASSWORD: ${{POSTGRES_PASSWORD}}
  volume:
    size: 10GB
    mount: /var/lib/postgresql/data
  plugins:
    - pgvector
    - pg_trgm
    - uuid-ossp

# Redis for caching and queues
redis:
  image: redis:7-alpine
  env:
    REDIS_PASSWORD: ${{REDIS_PASSWORD}}
  volume:
    size: 1GB
    mount: /data
  config:
    maxmemory: 512mb
    maxmemory-policy: allkeys-lru
```

### 3. Cloudflare (Storage & CDN)

#### R2 Object Storage

```typescript
// packages/core/src/storage/r2-config.ts
import { S3Client } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const buckets = {
  artifacts: 'penny-artifacts',
  uploads: 'penny-uploads',
  exports: 'penny-exports',
  backups: 'penny-backups',
};

// Multi-tenant storage paths
export function getStoragePath(tenantId: string, type: string, id: string) {
  return `tenants/${tenantId}/${type}/${id}`;
}
```

#### CDN Configuration

```javascript
// cloudflare-cdn.config.js
export default {
  zones: {
    'penny.ai': {
      // Cache rules
      rules: [
        {
          match: '/assets/*',
          cache: {
            ttl: 31536000, // 1 year
            browser_ttl: 86400, // 1 day
          }
        },
        {
          match: '/api/*',
          cache: {
            bypass: true // No caching for API
          }
        },
        {
          match: '/artifacts/*',
          cache: {
            ttl: 3600, // 1 hour
            respect_origin: true
          }
        }
      ],
      
      // Page rules
      page_rules: [
        {
          target: 'penny.ai/api/*',
          actions: {
            ssl: 'full',
            cache_level: 'bypass',
          }
        }
      ],
      
      // Workers for edge computing
      workers: {
        routes: [
          {
            pattern: '*/auth/*',
            script: 'auth-worker.js'
          },
          {
            pattern: '*/resize/*',
            script: 'image-resize.js'
          }
        ]
      }
    }
  }
};
```

#### Cloudflare Workers (Edge Computing)

```javascript
// workers/auth-worker.js
export default {
  async fetch(request, env) {
    // Verify JWT at edge
    const token = request.headers.get('Authorization');
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    try {
      const payload = await verifyJWT(token, env.JWT_SECRET);
      
      // Add user context to request
      request.headers.set('X-User-Id', payload.userId);
      request.headers.set('X-Tenant-Id', payload.tenantId);
      
      // Forward to origin
      return fetch(request);
    } catch (error) {
      return new Response('Invalid token', { status: 401 });
    }
  }
};
```

## Environment Configuration

### Development Environment

```bash
# .env.development
# Vercel
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3002

# Railway
API_URL=http://localhost:3001
WS_URL=ws://localhost:3003
DATABASE_URL=postgresql://postgres:password@localhost:5432/penny_dev
REDIS_URL=redis://localhost:6379

# Cloudflare
R2_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_PUBLIC_URL=https://cdn.penny.ai

# Auth
JWT_SECRET=dev-secret-change-in-production
NEXTAUTH_SECRET=dev-nextauth-secret
```

### Production Environment

```bash
# .env.production
# Vercel
NEXT_PUBLIC_APP_URL=https://app.penny.ai
NEXT_PUBLIC_ADMIN_URL=https://admin.penny.ai

# Railway
API_URL=https://api.penny.ai
WS_URL=wss://ws.penny.ai
DATABASE_URL=${{Railway.Postgres.DATABASE_URL}}
REDIS_URL=${{Railway.Redis.REDIS_URL}}

# Cloudflare
R2_ENDPOINT=${{Cloudflare.R2.ENDPOINT}}
R2_ACCESS_KEY_ID=${{Cloudflare.R2.ACCESS_KEY}}
R2_SECRET_ACCESS_KEY=${{Cloudflare.R2.SECRET_KEY}}
R2_PUBLIC_URL=https://cdn.penny.ai

# Auth (from Railway secrets)
JWT_SECRET=${{Railway.JWT_SECRET}}
NEXTAUTH_SECRET=${{Railway.NEXTAUTH_SECRET}}
```

## Deployment Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy Web to Vercel
        uses: vercel/actions@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_WEB_PROJECT_ID }}
          working-directory: ./apps/web
          
      - name: Deploy Admin to Vercel
        uses: vercel/actions@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_ADMIN_PROJECT_ID }}
          working-directory: ./apps/admin

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        uses: railway/deploy-action@v1
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
          service: api
          
      - name: Run Migrations
        run: |
          railway run npm run db:migrate

  upload-assets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Upload to Cloudflare R2
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: r2 object put penny-artifacts/static/ --file=./dist/assets/
```

## Service Communication

### API Gateway Pattern

```typescript
// apps/web/src/services/api-gateway.ts
class APIGateway {
  private baseURL: string;
  private wsURL: string;
  
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL!;
    this.wsURL = process.env.NEXT_PUBLIC_WS_URL!;
  }
  
  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new APIError(response.status, await response.text());
    }
    
    return response.json();
  }
  
  connectWebSocket(conversationId: string) {
    const ws = new WebSocket(`${this.wsURL}/chat/${conversationId}`);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth',
        token: this.getToken(),
      }));
    };
    return ws;
  }
}
```

### Cross-Service Authentication

```typescript
// packages/security/src/service-auth.ts
export class ServiceAuth {
  private static readonly services = {
    web: process.env.WEB_SERVICE_KEY,
    admin: process.env.ADMIN_SERVICE_KEY,
    worker: process.env.WORKER_SERVICE_KEY,
  };
  
  static async verifyServiceToken(token: string): Promise<string | null> {
    for (const [service, key] of Object.entries(this.services)) {
      if (await this.verifyHMAC(token, key!)) {
        return service;
      }
    }
    return null;
  }
  
  static generateServiceToken(service: string): string {
    const key = this.services[service as keyof typeof this.services];
    if (!key) throw new Error(`Unknown service: ${service}`);
    
    const payload = {
      service,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    
    return this.signHMAC(JSON.stringify(payload), key);
  }
}
```

## Monitoring & Observability

### Metrics Collection

```typescript
// packages/telemetry/src/providers/railway.ts
export class RailwayMetrics {
  async collect() {
    return {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      connections: {
        http: httpServer.connections,
        websocket: wsServer.clients.size,
        database: await pgPool.totalCount(),
        redis: await redis.client('list').length,
      },
      queues: {
        tools: await toolQueue.getJobCounts(),
        notifications: await notificationQueue.getJobCounts(),
      },
    };
  }
}
```

### Centralized Logging

```typescript
// packages/telemetry/src/loggers/cloudflare.ts
import { Logflare } from '@logflare/node';

export const logger = new Logflare({
  apiKey: process.env.LOGFLARE_API_KEY!,
  sourceToken: process.env.LOGFLARE_SOURCE!,
});

// Structured logging
export function log(level: string, message: string, context: any = {}) {
  logger.send({
    level,
    message,
    ...context,
    service: process.env.SERVICE_NAME,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
```

## Cost Optimization

### Resource Allocation

```yaml
# Railway resource limits
services:
  api:
    resources:
      cpu: 0.5
      memory: 512MB
      
  websocket:
    resources:
      cpu: 0.25
      memory: 256MB
      
  worker:
    resources:
      cpu: 1
      memory: 1GB
      
  postgres:
    resources:
      cpu: 1
      memory: 2GB
      disk: 20GB
      
  redis:
    resources:
      cpu: 0.25
      memory: 512MB
```

### Auto-scaling Configuration

```javascript
// vercel.json - Function configuration
{
  "functions": {
    "apps/web/api/*.ts": {
      "maxDuration": 10,
      "memory": 1024,
      "runtime": "nodejs18.x"
    }
  },
  "regions": ["iad1"], // Start with single region
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *" // Daily at 2 AM
    }
  ]
}
```

## Security Hardening

### Network Security

```yaml
# Railway private networking
services:
  api:
    internal_port: 3001
    public: true
    
  postgres:
    internal_port: 5432
    public: false # Only accessible within Railway
    
  redis:
    internal_port: 6379
    public: false # Only accessible within Railway
```

### Secrets Management

```typescript
// packages/security/src/secrets.ts
export class SecretsManager {
  private static cache = new Map<string, string>();
  
  static async get(key: string): Promise<string> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    // Fetch from Railway secrets
    const value = process.env[key];
    if (!value) {
      throw new Error(`Secret ${key} not found`);
    }
    
    // Cache for 5 minutes
    this.cache.set(key, value);
    setTimeout(() => this.cache.delete(key), 5 * 60 * 1000);
    
    return value;
  }
}
```

## Migration Strategy

### Phase 1: Setup Infrastructure (Week 1)
1. Create Vercel projects for web and admin
2. Set up Railway project with databases
3. Configure Cloudflare R2 and CDN
4. Set up CI/CD pipelines

### Phase 2: Deploy Services (Week 2)
1. Deploy frontend applications to Vercel
2. Deploy API and WebSocket services to Railway
3. Migrate data to Railway PostgreSQL
4. Configure Redis on Railway

### Phase 3: Integration (Week 3)
1. Connect all services
2. Configure environment variables
3. Set up monitoring and logging
4. Test end-to-end flows

### Phase 4: Optimization (Week 4)
1. Optimize caching strategies
2. Fine-tune auto-scaling
3. Implement cost monitoring
4. Performance testing

## Operational Runbook

### Deployment Commands

```bash
# Deploy frontend to Vercel
vercel --prod

# Deploy backend to Railway
railway up

# Upload assets to R2
wrangler r2 object put penny-artifacts/static/ --file=./dist/

# Run database migrations
railway run npm run db:migrate

# Check service health
curl https://api.penny.ai/health
```

### Monitoring Dashboards

1. **Vercel Dashboard**: Function invocations, bandwidth, errors
2. **Railway Dashboard**: CPU, memory, disk usage
3. **Cloudflare Dashboard**: CDN cache hits, bandwidth, R2 usage

### Incident Response

```typescript
// packages/monitoring/src/incidents.ts
export class IncidentResponse {
  static async handleOutage(service: string) {
    // 1. Check service health
    const health = await this.checkHealth(service);
    
    // 2. Attempt automatic recovery
    if (!health.healthy) {
      await this.restartService(service);
    }
    
    // 3. Notify team if still unhealthy
    if (!(await this.checkHealth(service)).healthy) {
      await this.notifyTeam({
        severity: 'critical',
        service,
        message: `${service} is down after restart attempt`,
      });
    }
  }
}
```

## Performance Benchmarks

### Target Metrics
- **TTFB**: < 100ms (served from CDN edge)
- **API Response**: < 200ms p50, < 500ms p95
- **WebSocket Latency**: < 50ms
- **Tool Execution**: < 5s for 95% of requests
- **Uptime**: 99.9% availability

### Load Testing

```bash
# API load testing
artillery run tests/load/api.yml

# WebSocket load testing
artillery run tests/load/websocket.yml

# End-to-end testing
npm run test:e2e:production
```

## Conclusion

This redesigned architecture leverages the strengths of each platform:

- **Vercel**: Optimal frontend hosting with global edge network
- **Railway**: Robust backend infrastructure with managed databases
- **Cloudflare**: Cost-effective storage and CDN with edge computing

The architecture provides:
- **Simplicity**: Three managed services instead of complex Kubernetes
- **Scalability**: Auto-scaling on all platforms
- **Cost-efficiency**: ~$100-200/month for production
- **Performance**: Global CDN and edge computing
- **Reliability**: Managed services with built-in redundancy

This design eliminates operational complexity while maintaining all PENNY platform capabilities.