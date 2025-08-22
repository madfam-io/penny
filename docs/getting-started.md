# Getting Started with PENNY

This guide will help you get PENNY up and running in your environment.

## Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+ with pgvector extension
- Redis 6+
- Docker and Docker Compose (optional)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/madfam-io/penny.git
cd penny
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
```

### 4. Configure Environment Variables

#### API Configuration (apps/api/.env)

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/penny"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"
ENCRYPTION_KEY="32-character-encryption-key-here"

# AI Providers
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Storage
STORAGE_PROVIDER="local" # or "s3"
STORAGE_LOCAL_PATH="./uploads"

# AWS (if using S3)
S3_BUCKET="penny-uploads"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
```

### 5. Database Setup

```bash
# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### 6. Start Development Servers

```bash
# Start all services
npm run dev

# Or start individually
npm run dev:api    # API server (port 3000)
npm run dev:web    # Web app (port 5173)
npm run dev:admin  # Admin dashboard (port 3001)
```

## Docker Deployment

For a quick start with Docker:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## First Steps

### 1. Access the Admin Dashboard

Navigate to `http://localhost:3001` and login with:
- Email: `admin@penny.ai`
- Password: `admin123`

### 2. Create Your First Tenant

1. Go to **Tenants** in the admin dashboard
2. Click **Create Tenant**
3. Fill in the organization details
4. Select a subscription plan

### 3. Invite Users

1. Navigate to **Users**
2. Click **Invite User**
3. Enter user details and select the tenant
4. The user will receive an invitation email

### 4. Access the Main Application

Users can access the main application at `http://localhost:5173`

## Configuration

### Multi-tenant Setup

PENNY supports multiple deployment modes:

#### Single Tenant Mode
Set in `apps/api/.env`:
```env
MULTI_TENANT_MODE=false
DEFAULT_TENANT_ID="default"
```

#### Multi-tenant with Subdomains
```env
MULTI_TENANT_MODE=true
TENANT_RESOLUTION=subdomain
BASE_DOMAIN=penny.local
```

#### Multi-tenant with Path Prefix
```env
MULTI_TENANT_MODE=true
TENANT_RESOLUTION=path
```

### AI Model Configuration

Configure available AI models in `apps/api/.env`:

```env
# Enable/disable providers
ENABLE_OPENAI=true
ENABLE_ANTHROPIC=true
ENABLE_MOCK=true # For development

# Model selection strategy
MODEL_SELECTION_STRATEGY=cost # or "performance", "balanced"

# Rate limits
AI_RATE_LIMIT_PER_MINUTE=60
AI_RATE_LIMIT_PER_DAY=1000
```

### Storage Configuration

#### Local Storage
```env
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=./uploads
STORAGE_BASE_URL=http://localhost:3000
```

#### AWS S3
```env
STORAGE_PROVIDER=s3
S3_BUCKET=penny-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

## Monitoring

### Health Check

Check system health:
```bash
curl http://localhost:3000/health
```

### Metrics

Access Prometheus metrics:
```bash
curl http://localhost:3000/metrics
```

## Troubleshooting

### Database Connection Issues

1. Ensure PostgreSQL is running:
   ```bash
   pg_isready
   ```

2. Check database exists:
   ```bash
   psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname='penny'"
   ```

3. Verify pgvector extension:
   ```bash
   psql -U postgres -d penny -c "CREATE EXTENSION IF NOT EXISTS vector"
   ```

### Redis Connection Issues

1. Check Redis is running:
   ```bash
   redis-cli ping
   ```

2. Verify connection:
   ```bash
   redis-cli -u redis://localhost:6379 ping
   ```

### Port Conflicts

If ports are already in use, modify in respective `.env` files:
- API: `PORT=3000`
- Web: `VITE_PORT=5173`
- Admin: `NEXT_PUBLIC_PORT=3001`

## Next Steps

- Read the [Architecture Guide](./architecture.md) to understand the system design
- Review the [API Reference](./api-reference.md) for integration
- Check the [Security Guide](./security.md) for best practices
- See the [Deployment Guide](./deployment.md) for production setup