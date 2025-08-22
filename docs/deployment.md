# Deployment Guide

This guide covers deploying PENNY to production environments.

## Deployment Options

### 1. Docker Compose (Small Scale)

Best for: Development, testing, small deployments

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: penny
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  api:
    image: penny/api:latest
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/penny
      REDIS_URL: redis://default:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  web:
    image: penny/web:latest
    environment:
      VITE_API_URL: https://api.penny.ai
    restart: unless-stopped

  admin:
    image: penny/admin:latest
    environment:
      NEXT_PUBLIC_API_URL: https://api.penny.ai
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
      - web
      - admin
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 2. Kubernetes (Production Scale)

Best for: Large scale, high availability requirements

#### Namespace and ConfigMap

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: penny

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: penny-config
  namespace: penny
data:
  API_URL: "https://api.penny.ai"
  REDIS_URL: "redis://redis:6379"
  MULTI_TENANT_MODE: "true"
```

#### PostgreSQL Deployment

```yaml
# k8s/postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: penny
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg15
        env:
        - name: POSTGRES_DB
          value: penny
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: "gp3"
      resources:
        requests:
          storage: 100Gi
```

#### API Deployment

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: penny
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: penny/api:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: jwt-secret
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: encryption-key
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
```

#### Autoscaling

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: penny
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 3. AWS Deployment

#### Infrastructure as Code (Terraform)

```hcl
# terraform/main.tf
provider "aws" {
  region = var.aws_region
}

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "penny-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = true
  
  tags = {
    Terraform = "true"
    Environment = var.environment
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier = "penny-postgres"
  
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = "db.r6g.xlarge"
  allocated_storage = 100
  storage_encrypted = true
  
  db_name  = "penny"
  username = "postgres"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.postgres.id]
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = false
  deletion_protection = true
  
  tags = {
    Name = "penny-postgres"
    Environment = var.environment
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "penny-redis"
  engine               = "redis"
  node_type            = "cache.r6g.large"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  
  subnet_group_name = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]
  
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"
  
  tags = {
    Name = "penny-redis"
    Environment = var.environment
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "penny-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  
  tags = {
    Name = "penny-cluster"
    Environment = var.environment
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "penny-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
  
  enable_deletion_protection = true
  enable_http2              = true
  
  tags = {
    Name = "penny-alb"
    Environment = var.environment
  }
}
```

## Environment Configuration

### Production Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@db.penny.ai:5432/penny?sslmode=require"
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=100

# Redis
REDIS_URL="rediss://default:pass@redis.penny.ai:6379"
REDIS_CLUSTER_MODE=true

# Security
JWT_SECRET="[64-character-random-string]"
ENCRYPTION_KEY="[32-character-random-string]"
CORS_ALLOWED_ORIGINS="https://penny.ai,https://app.penny.ai"

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
AI_RATE_LIMIT_PER_MINUTE=100
AI_RATE_LIMIT_PER_DAY=10000

# Storage
STORAGE_PROVIDER=s3
S3_BUCKET="penny-production-files"
S3_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."

# Monitoring
SENTRY_DSN="https://...@sentry.io/..."
PROMETHEUS_PUSHGATEWAY="http://prometheus:9091"
LOG_LEVEL="info"

# Feature Flags
ENABLE_BETA_FEATURES=false
MAINTENANCE_MODE=false
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d penny.ai -d api.penny.ai -d app.penny.ai

# Auto-renewal
sudo certbot renew --dry-run
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/penny
server {
    listen 443 ssl http2;
    server_name api.penny.ai;
    
    ssl_certificate /etc/letsencrypt/live/penny.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/penny.ai/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Database Migrations

### Production Migration Strategy

```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migrations
npm run db:migrate:deploy

# 3. Verify migration
npm run db:migrate:status
```

### Zero-Downtime Migrations

```typescript
// scripts/migrate-safe.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function safelyMigrate() {
  // 1. Create migration lock
  await execAsync('npm run db:lock:acquire');
  
  try {
    // 2. Run migrations
    await execAsync('npm run db:migrate:deploy');
    
    // 3. Verify schema
    await execAsync('npm run db:validate');
    
  } finally {
    // 4. Release lock
    await execAsync('npm run db:lock:release');
  }
}
```

## Monitoring Setup

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'penny-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    
  - job_name: 'penny-postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  - job_name: 'penny-redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Grafana Dashboards

Import these dashboard IDs:
- **Application Metrics**: 13659
- **PostgreSQL**: 9628
- **Redis**: 11835
- **Node.js**: 11159

## Backup and Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

# Configuration
BACKUP_DIR="/backups"
S3_BUCKET="penny-backups"
RETENTION_DAYS=30

# Database backup
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql.gz"

# Files backup
tar -czf "$BACKUP_DIR/files_$(date +%Y%m%d_%H%M%S).tar.gz" /uploads

# Upload to S3
aws s3 sync $BACKUP_DIR s3://$S3_BUCKET/

# Clean old backups
find $BACKUP_DIR -mtime +$RETENTION_DAYS -delete
aws s3 ls s3://$S3_BUCKET/ | while read -r line; do
  createDate=$(echo $line | awk {'print $1" "$2'})
  createDate=$(date -d"$createDate" +%s)
  olderThan=$(date -d"-$RETENTION_DAYS days" +%s)
  if [[ $createDate -lt $olderThan ]]; then
    fileName=$(echo $line | awk {'print $4'})
    aws s3 rm s3://$S3_BUCKET/$fileName
  fi
done
```

## Health Checks

### Application Health Check

```typescript
// src/health.ts
app.get('/health', async (req, res) => {
  const checks = {
    api: 'ok',
    database: 'ok',
    redis: 'ok',
    storage: 'ok',
  };
  
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    checks.database = 'error';
  }
  
  try {
    // Check Redis
    await redis.ping();
  } catch (error) {
    checks.redis = 'error';
  }
  
  const allOk = Object.values(checks).every(status => status === 'ok');
  
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  });
});
```

## Security Hardening

### 1. Network Security

```bash
# UFW firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

### 2. Application Security

```typescript
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### 3. Database Security

```sql
-- Enable row level security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY tenant_isolation ON conversations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

## Performance Optimization

### 1. CDN Configuration

```javascript
// CloudFront distribution
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.LoadBalancerV2Origin(alb),
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
  domainNames: ['penny.ai', 'www.penny.ai'],
  certificate: certificate,
});
```

### 2. Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_conversations_tenant_user ON conversations(tenant_id, user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Analyze tables
ANALYZE conversations;
ANALYZE messages;
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory usage
   docker stats
   
   # Increase Node.js memory
   NODE_OPTIONS="--max-old-space-size=4096"
   ```

2. **Database Connection Errors**
   ```bash
   # Check connection pool
   SELECT count(*) FROM pg_stat_activity;
   
   # Increase pool size
   DATABASE_POOL_MAX=200
   ```

3. **Redis Memory Issues**
   ```bash
   # Check memory usage
   redis-cli INFO memory
   
   # Set memory policy
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

### Logs and Debugging

```bash
# View application logs
kubectl logs -f deployment/api -n penny

# View all logs for a pod
kubectl logs -f pod-name --all-containers=true

# Debug pod
kubectl exec -it pod-name -- /bin/bash
```