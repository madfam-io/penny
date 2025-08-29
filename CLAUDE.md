# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Project Overview

PENNY is a multi-tenant, AI-first workbench platform combining conversational chat with artifact
visualization. The project follows an "Ask, act, and see" philosophy - chat to request outcomes,
trigger tools to act, and visualize artifacts instantly.

**Current Status:** Specification/planning phase (no implementation code yet)

## Architecture Overview

The system follows a microservices architecture with these core components:

### Frontend

- **Web App (SPA)**: Chat interface + Artifact Viewer
- **Tech Stack**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Layout**: Left (conversations), Center (chat stream), Right (artifact panel)

### Backend Services

- **Conversation Service**: Threading, memory, message storage
- **Model Orchestrator**: Provider abstraction, routing policies
- **Tool Router**: JSON-schema function registry, auth-scoped tools
- **Artifact Registry**: Versioned artifacts with metadata
- **Auth Service**: OIDC/OAuth2, RBAC, multi-tenant isolation

### Data Layer

- **Primary DB**: PostgreSQL with pgvector for vector search
- **Cache**: Valkey (Redis fork)
- **Object Storage**: S3-compatible for artifacts
- **Vector Store**: pgvector (default), with Weaviate/Milvus as alternatives

### Model Layer

- **Local Models**: Ollama (dev), vLLM/TGI (production)
- **External Providers**: OpenAI, Anthropic, Gemini via provider registry

## Development Phases

### Phase 0: Spike (2-3 weeks)

- Fork base chat platform (LibreChat or LobeChat)
- Implement 2 tools: `get_company_kpis`, `load_dashboard`
- Add artifact inline previews

### Phase 1: Internal Beta (4-6 weeks)

- Code sandbox (Python)
- Integrations: Jira, Slack, Email
- Vector store & RAG
- Admin console
- RBAC & audit logging

### Phase 2: v1 Readiness (4-6 weeks)

- White-label theming
- Plugin marketplace
- Scale hardening
- Documentation

## Key Technical Decisions

### Base Platform (ADR-01)

- **Option A**: LibreChat (MIT) - mature multi-user + plugins
- **Option B**: LobeChat (Apache-2.0) - modern UI + marketplace
- **Recommendation**: Start with LibreChat, port artifact concepts from LobeChat

### Technology Stack

- **API Framework**: Fastify with OpenAPI/Zod validation
- **Observability**: OpenTelemetry + Jaeger
- **Infrastructure**: Kubernetes, Helm, OpenTofu (not Terraform)
- **CI/CD**: GitHub Actions, trunk-based development

### Security Requirements

- Tenant isolation at every layer
- Row-level security in PostgreSQL
- Dedicated vector namespaces per tenant
- TLS in transit, KMS-backed encryption at rest
- Audit logging for all tool calls and data access

## API Contracts

### Chat API

```
POST /v1/chat/:conversationId/messages
Body: { content, attachments[], toolsAllowed[], artifactsExpected[] }
```

### Tool Invocation

```
POST /v1/tools/:name/invoke
Body: tool-specific JSON schema
```

### Artifacts

```
GET /v1/artifacts/:id
POST /v1/artifacts
```

## Performance Targets

- Time to First Token (TTFT): ≤ 600ms p50
- End-to-end response: ≤ 4s p50
- Tool invocation success rate: ≥ 95%
- Concurrent chats: 500 (MVP), 2000 (v1)

## License Considerations

- Prefer: Apache-2.0, MIT, BSD-3-Clause
- Avoid: AGPL-3.0, SSPL-1.0, BUSL-1.1
- Use Valkey instead of Redis (licensing)
- Use OpenTofu instead of Terraform (licensing)

## Multi-Tenant Architecture

- Tenant scoping at every layer
- Per-tenant: plugins, datasources, themes, vector namespaces
- RBAC roles: admin, manager, creator, viewer
- Policy-based external model restrictions

## Development Commands

### Initial Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start Docker services (PostgreSQL, Valkey, MinIO, Jaeger, Ollama)
make setup-local

# Run database migrations (when available)
npm run db:migrate
```

### Development

```bash
# Start all development servers
npm run dev

# Start specific app/package
npm run dev --filter=@penny/web
npm run dev --filter=@penny/api

# Build all packages
npm run build

# Build specific package
npm run build --filter=@penny/security
```

### Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run e2e tests
npm run test:e2e

# Run tests for specific package
npm run test --filter=@penny/security
```

### Code Quality

```bash
# Run linting
npm run lint

# Run type checking
npm run typecheck

# Format code
npm run format

# Check formatting
npm run format:check
```

### Docker Services

```bash
# Start all services
make docker-up

# Stop all services
make docker-down

# View logs
make docker-logs

# Reset database
make reset-db
```

### Environment Variables

Key environment variables are defined in `.env.example`. Copy to `.env` and update:

- Database credentials
- Redis/Valkey connection
- S3/MinIO settings
- JWT secrets
- API keys for external services
- Feature flags

### Monorepo Structure

- `/packages/*` - Shared libraries
- `/apps/*` - Applications (web, api, admin)
- `/tools/*` - Build tools and scripts
- `/config/*` - Shared configuration
