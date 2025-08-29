# Deployment Guide

This section contains comprehensive deployment documentation for the PENNY platform across different environments and infrastructure providers.

## Table of Contents

1. [Installation Guide](./installation.md) - Getting started with deployment
2. [Infrastructure Setup](./infrastructure.md) - Infrastructure redesign and setup
3. [Environment Configuration](./environment.md) - Environment variables and configuration
4. [Vercel Deployment](./vercel.md) - Frontend deployment to Vercel
5. [Railway Deployment](./railway.md) - Backend services on Railway
6. [Cloudflare Setup](./cloudflare.md) - CDN and edge computing setup
7. [Monitoring & Observability](./monitoring.md) - Production monitoring setup
8. [Security Hardening](./security-hardening.md) - Production security checklist
9. [Backup & Recovery](./backup-recovery.md) - Data protection strategies
10. [Scaling Guide](./scaling.md) - Horizontal and vertical scaling

## Quick Deployment

### Prerequisites
- Vercel account and CLI
- Railway account and CLI  
- Cloudflare account and CLI (Wrangler)
- Domain name (optional)

### One-Command Deployment
```bash
# Clone and deploy
git clone https://github.com/madfam-io/penny.git
cd penny

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Deploy everything
./scripts/deploy.sh
```

## Deployment Architecture

PENNY uses a hybrid cloud architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     VERCEL      │    │    RAILWAY      │    │   CLOUDFLARE    │
│                 │    │                 │    │                 │
│  Web App        │    │  API Server     │    │  Workers        │
│  Admin Console  │    │  WebSocket      │    │  R2 Storage     │
│  Static Assets  │    │  Database       │    │  CDN            │
│                 │    │  Redis          │    │  Edge Auth      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Service Distribution

**Vercel** (Frontend)
- Web Application (React + Vite)
- Admin Console (Next.js)
- Static asset hosting
- Global CDN distribution

**Railway** (Backend)  
- API Server (Node.js + Fastify)
- WebSocket Service (Socket.io)
- Background Workers
- PostgreSQL Database
- Redis/Valkey Cache

**Cloudflare** (Edge + Storage)
- Workers for edge computing
- R2 for object storage
- CDN for global content delivery
- Edge authentication

## Environment-Specific Deployment

### Development
```bash
# Local development
npm run dev

# Docker development
docker-compose up -d
npm run dev
```

### Staging
```bash
# Deploy to staging
./scripts/deploy.sh --staging
```

### Production
```bash
# Production deployment with health checks
./scripts/deploy.sh --production
```

## Infrastructure as Code

### Terraform (Optional)
```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

### Helm Charts (Kubernetes)
```bash
cd infrastructure/helm
helm install penny ./penny-chart
```

## Monitoring & Health Checks

### Health Check Endpoints
- API: `GET /health`
- WebSocket: `GET /ws/health`
- Database: `GET /health/db`
- Redis: `GET /health/redis`

### Monitoring Stack
- **Metrics**: Prometheus + Grafana
- **Tracing**: Jaeger + OpenTelemetry  
- **Logging**: Structured logs + ELK Stack
- **Alerting**: PagerDuty + Slack

## Cost Optimization

### Estimated Monthly Costs

**Vercel Pro Team**: ~$20/month
- Unlimited deployments
- Edge functions
- Analytics

**Railway**: ~$20-50/month  
- Resource-based pricing
- PostgreSQL + Redis
- Auto-scaling

**Cloudflare**: ~$5-20/month
- R2 storage
- Workers compute
- CDN bandwidth

**Total**: ~$45-90/month for small-medium workloads

## Troubleshooting

### Common Issues

**Deployment Failures**
- Check service logs: `railway logs`
- Verify environment variables
- Check database connectivity

**Performance Issues**  
- Monitor resource usage
- Check database query performance
- Review CDN cache hit rates

**Connection Issues**
- Verify CORS settings
- Check SSL certificate validity
- Test WebSocket connectivity

## Support

- [GitHub Issues](https://github.com/madfam-io/penny/issues)
- [Discord Community](https://discord.gg/penny)
- Enterprise Support: deployment@penny.ai

## Next Steps

After successful deployment:
1. [Configure monitoring](./monitoring.md)
2. [Set up backup strategies](./backup-recovery.md)
3. [Review security hardening](./security-hardening.md)
4. [Plan scaling approach](./scaling.md)