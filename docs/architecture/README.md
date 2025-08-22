# PENNY Architecture

## Overview

PENNY is built as a cloud-native, multi-tenant platform following microservices architecture principles. The system is designed for high availability, scalability, and security.

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web App]
        MOBILE[Mobile App]
        CLI[CLI Tool]
    end

    subgraph "Edge Layer"
        LB[Load Balancer]
        WAF[Web Application Firewall]
        CDN[CDN]
    end

    subgraph "API Gateway Layer"
        APIGW[API Gateway]
        AUTH[Auth Service]
        RATE[Rate Limiter]
    end

    subgraph "Service Layer"
        CHAT[Chat Service]
        TOOL[Tool Service]
        ARTIFACT[Artifact Service]
        MODEL[Model Service]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        VALKEY[(Valkey Cache)]
        S3[(Object Storage)]
        VECTOR[(Vector DB)]
    end

    subgraph "Infrastructure"
        K8S[Kubernetes]
        MONITOR[Monitoring]
        LOG[Logging]
    end

    WEB --> LB
    MOBILE --> LB
    CLI --> LB
    
    LB --> WAF
    WAF --> CDN
    CDN --> APIGW
    
    APIGW --> AUTH
    APIGW --> RATE
    
    AUTH --> CHAT
    AUTH --> TOOL
    AUTH --> ARTIFACT
    AUTH --> MODEL
    
    CHAT --> PG
    CHAT --> VALKEY
    TOOL --> PG
    ARTIFACT --> S3
    MODEL --> VECTOR
    
    K8S --> MONITOR
    K8S --> LOG
```

## Key Design Principles

### 1. Multi-Tenancy
- Complete data isolation at database level
- Tenant-specific encryption keys
- Resource quotas per tenant
- Customizable features and limits

### 2. Security First
- Zero-trust network architecture
- End-to-end encryption
- Regular security audits
- Compliance with SOC2, GDPR

### 3. Scalability
- Horizontal scaling for all services
- Auto-scaling based on metrics
- Efficient resource utilization
- Global distribution ready

### 4. Extensibility
- Plugin architecture for tools
- Custom model integration
- Webhook support
- API-first design

## Service Architecture

### API Gateway
- Request routing
- Authentication/Authorization
- Rate limiting
- Request/Response transformation
- WebSocket support

### Chat Service
- Conversation management
- Message streaming
- Context preservation
- Multi-model support

### Tool Service
- Tool registry
- Execution sandbox
- Permission management
- Result caching

### Artifact Service
- Artifact storage
- Version control
- Access control
- CDN distribution

### Model Service
- Model routing
- Load balancing
- Fallback handling
- Performance monitoring

## Data Architecture

### Primary Database (PostgreSQL)
- Tenant isolation via RLS
- JSONB for flexible schemas
- Partitioning for scale
- Read replicas for performance

### Cache Layer (Valkey)
- Session storage
- Temporary data
- Rate limit counters
- Pub/sub for events

### Object Storage
- Artifact storage
- File attachments
- Model weights
- Backup storage

### Vector Database
- Embedding storage
- Similarity search
- RAG support
- Tenant isolation

## Deployment Architecture

### Container Orchestration
- Kubernetes for container management
- Helm charts for deployment
- GitOps with ArgoCD
- Multi-region support

### CI/CD Pipeline
- GitHub Actions for automation
- Automated testing
- Security scanning
- Progressive rollouts

### Monitoring & Observability
- OpenTelemetry for tracing
- Prometheus for metrics
- ELK stack for logging
- Custom dashboards

## Security Architecture

### Network Security
- Private subnets
- Network policies
- TLS everywhere
- DDoS protection

### Application Security
- OWASP compliance
- Input validation
- Output encoding
- Security headers

### Data Security
- Encryption at rest
- Encryption in transit
- Key rotation
- Audit logging

## Performance Targets

- API Response: < 100ms p50
- Chat Response: < 600ms TTFT
- Availability: 99.9% SLA
- RPO: 1 hour
- RTO: 4 hours