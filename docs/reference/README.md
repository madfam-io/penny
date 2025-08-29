# Reference Documentation

Technical reference materials for the PENNY platform.

## Table of Contents

1. [Configuration Reference](./configuration.md) - Complete configuration options
2. [Tool Registry](./tools.md) - Built-in tools reference
3. [API Reference](../api/) - REST API documentation
4. [Environment Variables](./environment-variables.md) - All environment variables
5. [Database Schema](./database-schema.md) - Database structure reference
6. [Error Codes](./error-codes.md) - Error codes and messages
7. [Webhooks](./webhooks.md) - Webhook events and payloads
8. [CLI Reference](./cli.md) - Command-line interface
9. [Glossary](./glossary.md) - Terms and definitions
10. [Changelog](./changelog.md) - Version history and changes

## Quick Reference

### Essential Configuration
```env
# Core Services
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
API_PORT=3001

# Authentication
NEXTAUTH_SECRET=your-secret
JWT_SECRET=your-jwt-secret

# AI Models
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Built-in Tools
- `get_company_kpis` - Retrieve company KPIs
- `load_dashboard` - Load dashboard widgets
- `python_code` - Execute Python code
- `search_documents` - Search document content
- `send_email` - Send email messages
- `create_jira_ticket` - Create Jira issues
- `slack_message` - Send Slack messages

### API Endpoints
- `POST /v1/chat/:conversationId/messages` - Send message
- `GET /v1/conversations` - List conversations
- `POST /v1/tools/:name/invoke` - Execute tool
- `GET /v1/artifacts/:id` - Get artifact

### Error Codes
- `1001` - Authentication failed
- `1002` - Authorization denied  
- `2001` - Tool execution failed
- `3001` - Artifact not found
- `4001` - Rate limit exceeded

## Configuration Categories

### Application Configuration
- Server settings
- Database connections
- Cache configuration
- Logging settings

### Authentication & Security
- OAuth provider settings
- JWT configuration
- Session management
- Security policies

### AI Model Configuration
- Provider settings
- Model selection
- Rate limiting
- Cost controls

### Integration Settings
- External service APIs
- Webhook configurations
- Email settings
- File storage

## Database Schema Reference

### Core Tables
- `tenants` - Tenant information
- `users` - User accounts
- `conversations` - Chat conversations
- `messages` - Chat messages
- `artifacts` - Generated artifacts
- `tools` - Tool registry
- `executions` - Tool execution logs

### Relationships
- Tenant → Users (1:many)
- User → Conversations (1:many)  
- Conversation → Messages (1:many)
- Message → Artifacts (1:many)
- Tool → Executions (1:many)

## Environment Variables Reference

### Required Variables
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
NEXTAUTH_SECRET=your-secret
JWT_SECRET=your-jwt-secret
```

### Optional Variables
```env
NODE_ENV=development
LOG_LEVEL=info
API_PORT=3001
WS_PORT=3003
```

### Feature Flags
```env
FEATURE_PYTHON_SANDBOX=true
FEATURE_JIRA_INTEGRATION=true
FEATURE_SLACK_INTEGRATION=true
FEATURE_EXPORT_PDF=false
```

## Tool Schema Reference

### Tool Definition Format
```json
{
  "name": "tool_name",
  "displayName": "Tool Display Name",
  "description": "Tool description",
  "category": "analytics|automation|integration",
  "schema": {
    "type": "object",
    "properties": {
      "param1": {
        "type": "string",
        "description": "Parameter description"
      }
    },
    "required": ["param1"]
  },
  "permissions": ["read", "write"],
  "cost": 1
}
```

### Built-in Tool Schemas
Each built-in tool has a complete JSON schema defining:
- Input parameters
- Validation rules
- Output format
- Permission requirements
- Cost calculation

## Webhook Reference

### Event Types
- `message.created` - New message
- `tool.executed` - Tool execution
- `artifact.created` - New artifact
- `conversation.created` - New conversation
- `user.joined` - User joined tenant

### Payload Format
```json
{
  "id": "evt_123",
  "type": "message.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": { ... }
}
```

## CLI Reference

### Installation
```bash
npm install -g @penny/cli
```

### Commands
```bash
penny login                    # Authenticate
penny conversations list       # List conversations
penny tools list              # List available tools
penny artifacts export <id>   # Export artifact
penny deploy                  # Deploy to production
```

## Version Compatibility

### API Versioning
- v1 - Current stable version
- v2 - Beta features (preview)

### Client SDK Versions
- JavaScript SDK: ^1.0.0
- Python SDK: ^1.0.0
- CLI: ^1.0.0

### Breaking Changes
See [Changelog](./changelog.md) for version-specific breaking changes and migration guides.

## Standards & Conventions

### API Design
- RESTful endpoints
- JSON request/response
- ISO 8601 timestamps
- Semantic versioning

### Data Formats
- UTF-8 encoding
- JSON Schema validation
- ISO currency codes
- RFC 3339 timestamps

### Naming Conventions
- camelCase for JSON fields
- snake_case for database columns
- kebab-case for API endpoints
- PascalCase for type names

---

*Looking for something specific? Try the [Glossary](./glossary.md) or [API Reference](../api/)*