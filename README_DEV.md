# PENNY Development Guide

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Git
- (Optional) NVIDIA GPU + CUDA for local LLM inference

### Quick Start

```bash
# Clone the repository
git clone https://github.com/madfam-io/penny.git
cd penny

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start infrastructure
make setup-local

# Start development
npm run dev
```

## 🏗️ Project Structure

```
penny/
├── apps/                    # Applications
│   ├── web/                # Main web application (React)
│   ├── api/                # API gateway (Fastify)
│   └── admin/              # Admin console
├── packages/               # Shared packages
│   ├── core/              # Core business logic
│   ├── security/          # Security utilities
│   ├── shared/            # Shared types and utilities
│   ├── database/          # Database client and migrations
│   ├── telemetry/         # Observability
│   ├── ui/                # UI component library
│   └── api-client/        # TypeScript API client
├── tools/                  # Build and development tools
├── config/                 # Shared configuration
├── scripts/               # Utility scripts
└── docs/                  # Documentation
```

## 🛠️ Development Workflow

### 1. Working with the Monorepo

This project uses npm workspaces and Turborepo:

```bash
# Run command in all packages
npm run build

# Run command in specific package
npm run build --filter=@penny/security

# Run command in app and dependencies
npm run dev --filter=@penny/web...

# Add dependency to specific package
npm install express -w @penny/api
```

### 2. Creating New Packages

```bash
# Create package directory
mkdir -p packages/new-package/src

# Initialize package.json
cd packages/new-package
npm init -y

# Update package.json name to @penny/new-package
# Add to tsconfig.base.json paths
```

### 3. Database Development

```bash
# Create migration
npm run db:migrate:create -- --name add_users_table

# Run migrations
npm run db:migrate

# Rollback migration
npm run db:migrate:rollback

# Reset database
make reset-db
```

### 4. Testing Strategy

- Unit tests: Vitest for fast testing
- Integration tests: Supertest for API testing
- E2E tests: Playwright for browser testing
- Load tests: Artillery for performance testing

```bash
# Run specific test file
npm run test -- auth.test.ts

# Run with coverage
npm run test -- --coverage

# Debug tests
npm run test -- --inspect
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available options. Key variables:

- `NODE_ENV`: development | production | test
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Valkey/Redis connection
- `JWT_SECRET`: Authentication secret
- `MASTER_ENCRYPTION_KEY`: Data encryption key

### Feature Flags

Control features via environment:

- `ENABLE_CODE_EXECUTION`: Python sandbox
- `ENABLE_EXTERNAL_MODELS`: External AI providers
- `ENABLE_CUSTOM_PLUGINS`: Plugin marketplace

## 🐳 Infrastructure

### Local Services

- **PostgreSQL + pgvector**: Main database with vector search
- **Valkey**: Caching and queues
- **MinIO**: S3-compatible object storage
- **Jaeger**: Distributed tracing
- **Ollama**: Local LLM inference

### Service URLs

- Web App: http://localhost:5173
- API: http://localhost:3000
- MinIO Console: http://localhost:9001
- Jaeger UI: http://localhost:16686

## 📦 Key Packages

### @penny/shared

Core types, schemas, constants, and utilities used across the platform.

### @penny/security

- Password hashing (Argon2)
- JWT handling
- Encryption/decryption
- RBAC implementation
- Input sanitization

### @penny/database

- Prisma client
- Migration utilities
- Connection pooling
- Query builders

### @penny/telemetry

- OpenTelemetry integration
- Custom metrics
- Trace context propagation
- Performance monitoring

## 🔐 Security Considerations

1. **Multi-tenancy**: All queries include tenant isolation
2. **Encryption**: Sensitive data encrypted at rest
3. **Authentication**: JWT with refresh tokens
4. **Authorization**: Role-based access control
5. **Rate Limiting**: Per-tenant and per-user limits
6. **Input Validation**: Zod schemas for all inputs

## 📊 Monitoring

### Metrics

- Request latency (p50, p95, p99)
- Token usage per tenant
- Tool execution success rate
- Model inference time

### Logging

Structured JSON logging with correlation IDs:

```typescript
logger.info('Tool executed', {
  toolName: 'get_company_kpis',
  duration: 1234,
  tenantId: 'abc123',
  traceId: 'xyz789',
});
```

### Tracing

OpenTelemetry traces for request flow:

- HTTP requests
- Database queries
- LLM calls
- Tool executions

## 🚢 Deployment

### Development

```bash
npm run build
npm run start
```

### Production

```bash
# Build containers
docker build -t penny-web apps/web
docker build -t penny-api apps/api

# Deploy with Kubernetes
kubectl apply -k deploy/
```

## 📝 Contributing

1. Create feature branch: `git checkout -b feat/amazing-feature`
2. Commit with conventional commits: `feat(api): add new endpoint`
3. Run tests: `npm run test`
4. Submit PR with description

### Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Tests
- `build`: Build system
- `ci`: CI/CD
- `chore`: Maintenance
- `security`: Security fix

## 🆘 Troubleshooting

### Common Issues

**Dependencies not installing**

```bash
npm run clean
rm -rf node_modules
npm install
```

**Type errors in IDE**

```bash
npm run build --filter=@penny/shared
# Restart TypeScript server in IDE
```

**Docker services not starting**

```bash
docker-compose down -v
make docker-up
```

**Database connection errors** Check PostgreSQL is running and migrations are applied:

```bash
docker-compose ps
npm run db:migrate
```

## 📚 Resources

- [Architecture Diagrams](./docs/architecture/)
- [API Documentation](./docs/api/)
- [Security Guidelines](./docs/security/)
- [Performance Benchmarks](./docs/performance/)
