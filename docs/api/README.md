# API Reference

## Overview

The PENNY API provides a comprehensive set of endpoints for managing conversations, executing tools, handling artifacts, and administering the platform. All API requests require authentication unless specified otherwise.

## Base URL

```
Production: https://api.penny.ai/v1
Development: http://localhost:3001/v1
```

## Authentication

PENNY uses JWT-based authentication with OAuth2/OIDC providers.

### Headers

```http
Authorization: Bearer <jwt_token>
X-Tenant-ID: <tenant_id>
Content-Type: application/json
```

### Getting a Token

```http
POST /auth/login
Content-Type: application/json

{
  "provider": "google" | "github" | "credentials",
  "code": "<oauth_code>",
  // OR for credentials
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "tenantId": "tenant_456"
  },
  "expiresIn": 3600
}
```

## Core Endpoints

### Conversations

#### List Conversations

```http
GET /conversations
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 20, max: 100)
  - search: string (optional)
  - archived: boolean (default: false)

Response:
{
  "conversations": [
    {
      "id": "conv_abc123",
      "title": "Marketing Strategy Discussion",
      "lastMessage": "Let me analyze the Q3 marketing data...",
      "lastMessageAt": "2024-01-15T10:30:00Z",
      "messageCount": 42,
      "createdAt": "2024-01-15T09:00:00Z",
      "archived": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  }
}
```

#### Create Conversation

```http
POST /conversations
Content-Type: application/json

{
  "title": "New Conversation",
  "metadata": {
    "project": "Q1 Planning"
  }
}

Response:
{
  "id": "conv_xyz789",
  "title": "New Conversation",
  "createdAt": "2024-01-15T11:00:00Z",
  "metadata": {
    "project": "Q1 Planning"
  }
}
```

#### Get Conversation

```http
GET /conversations/:conversationId

Response:
{
  "id": "conv_abc123",
  "title": "Marketing Strategy Discussion",
  "messages": [...],
  "artifacts": [...],
  "participants": [...],
  "createdAt": "2024-01-15T09:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Messages

#### Send Message (Streaming)

```http
POST /chat/:conversationId/messages
Content-Type: application/json

{
  "content": "Show me the company KPIs for Q3",
  "attachments": [
    {
      "type": "file",
      "id": "file_123"
    }
  ],
  "toolsAllowed": ["get_company_kpis", "load_dashboard"],
  "stream": true
}

Response (Server-Sent Events):
data: {"type": "token", "content": "Let"}
data: {"type": "token", "content": " me"}
data: {"type": "token", "content": " fetch"}
data: {"type": "tool_call", "tool": "get_company_kpis", "params": {"period": "Q3"}}
data: {"type": "tool_result", "tool": "get_company_kpis", "result": {...}}
data: {"type": "artifact", "artifact": {...}}
data: {"type": "done", "messageId": "msg_456"}
```

#### Send Message (Non-Streaming)

```http
POST /chat/:conversationId/messages
Content-Type: application/json

{
  "content": "What were our top products last month?",
  "stream": false
}

Response:
{
  "id": "msg_789",
  "conversationId": "conv_abc123",
  "role": "assistant",
  "content": "Based on last month's sales data, your top 3 products were...",
  "toolCalls": [...],
  "artifacts": [...],
  "createdAt": "2024-01-15T11:00:00Z"
}
```

### Tools

#### List Available Tools

```http
GET /tools

Response:
{
  "tools": [
    {
      "name": "get_company_kpis",
      "displayName": "Get Company KPIs",
      "description": "Retrieve company key performance indicators",
      "category": "analytics",
      "schema": {
        "type": "object",
        "properties": {
          "period": {
            "type": "string",
            "enum": ["MTD", "QTD", "YTD"]
          }
        }
      },
      "permissions": ["analytics:read"],
      "cost": 1
    }
  ]
}
```

#### Execute Tool

```http
POST /tools/:toolName/invoke
Content-Type: application/json

{
  "params": {
    "period": "QTD",
    "unit": "company"
  },
  "conversationId": "conv_abc123"
}

Response:
{
  "executionId": "exec_123",
  "tool": "get_company_kpis",
  "status": "completed",
  "result": {
    "revenue": 2450000,
    "profit": 560000,
    "customers": 1543,
    "efficiency": 78.5
  },
  "artifacts": [...],
  "duration": 245,
  "credits": 1
}
```

### Artifacts

#### Get Artifact

```http
GET /artifacts/:artifactId

Response:
{
  "id": "art_123",
  "type": "dashboard",
  "name": "Company Health Dashboard",
  "content": {...},
  "mimeType": "application/vnd.penny.dashboard+json",
  "metadata": {
    "tool": "load_dashboard",
    "conversationId": "conv_abc123",
    "version": 1
  },
  "url": "https://cdn.penny.ai/artifacts/art_123",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

#### Create Artifact

```http
POST /artifacts
Content-Type: multipart/form-data

{
  "type": "document",
  "name": "Q3 Report.pdf",
  "file": <binary>,
  "metadata": {
    "conversationId": "conv_abc123"
  }
}

Response:
{
  "id": "art_456",
  "type": "document",
  "name": "Q3 Report.pdf",
  "url": "https://cdn.penny.ai/artifacts/art_456",
  "size": 2048576,
  "createdAt": "2024-01-15T11:00:00Z"
}
```

### WebSocket API

#### Connection

```javascript
const ws = new WebSocket('wss://api.penny.ai/v1/ws');

// Authenticate
ws.send(JSON.stringify({
  type: 'authenticate',
  token: 'Bearer <jwt_token>'
}));

// Join conversation
ws.send(JSON.stringify({
  type: 'join',
  conversationId: 'conv_abc123'
}));
```

#### Message Types

```javascript
// Send message
{
  "type": "message",
  "conversationId": "conv_abc123",
  "content": "What's our revenue this quarter?"
}

// Receive tokens
{
  "type": "token",
  "conversationId": "conv_abc123",
  "content": "Based"
}

// Tool execution
{
  "type": "tool_call",
  "tool": "get_company_kpis",
  "params": {...}
}

// Tool result
{
  "type": "tool_result",
  "tool": "get_company_kpis",
  "result": {...}
}

// Typing indicator
{
  "type": "typing",
  "conversationId": "conv_abc123",
  "userId": "user_123"
}

// Error
{
  "type": "error",
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT"
}
```

## Admin Endpoints

### Users

#### List Users

```http
GET /admin/users
Query Parameters:
  - page: number
  - limit: number
  - role: string
  - search: string

Response:
{
  "users": [
    {
      "id": "user_123",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "admin",
      "status": "active",
      "lastLogin": "2024-01-15T09:00:00Z"
    }
  ],
  "pagination": {...}
}
```

#### Update User Role

```http
PATCH /admin/users/:userId/role
Content-Type: application/json

{
  "role": "manager"
}

Response:
{
  "id": "user_123",
  "role": "manager",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

### Plugins

#### List Plugins

```http
GET /admin/plugins

Response:
{
  "plugins": [
    {
      "id": "plugin_slack",
      "name": "Slack Integration",
      "version": "1.2.0",
      "enabled": true,
      "config": {...}
    }
  ]
}
```

#### Enable/Disable Plugin

```http
PATCH /admin/plugins/:pluginId
Content-Type: application/json

{
  "enabled": true,
  "config": {
    "webhookUrl": "https://hooks.slack.com/..."
  }
}
```

### Billing

#### Get Usage

```http
GET /admin/billing/usage
Query Parameters:
  - startDate: ISO date
  - endDate: ISO date

Response:
{
  "period": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "usage": {
    "messages": 15234,
    "toolExecutions": 3421,
    "tokens": 4567890,
    "storage": 2147483648,
    "users": 45
  },
  "costs": {
    "compute": 234.56,
    "storage": 12.34,
    "network": 5.67,
    "total": 252.57
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Conversation not found",
    "details": {
      "conversationId": "conv_invalid"
    }
  },
  "statusCode": 404
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `TOOL_EXECUTION_ERROR` | 500 | Tool failed to execute |
| `MODEL_ERROR` | 502 | AI model request failed |

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Chat messages | 60 | 1 minute |
| Tool executions | 100 | 1 minute |
| Artifact uploads | 10 | 1 minute |
| API general | 1000 | 1 minute |

Rate limit headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705315200
```

## Pagination

Standard pagination response:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Webhooks

Configure webhooks to receive real-time events:

```http
POST /admin/webhooks
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/penny",
  "events": ["message.created", "tool.executed", "artifact.created"],
  "secret": "whsec_abc123"
}
```

### Event Types

- `message.created` - New message in conversation
- `message.updated` - Message edited
- `tool.executed` - Tool execution completed
- `artifact.created` - New artifact generated
- `conversation.created` - New conversation started
- `user.joined` - User joined tenant
- `user.left` - User left tenant

### Webhook Payload

```json
{
  "id": "evt_123",
  "type": "message.created",
  "timestamp": "2024-01-15T11:00:00Z",
  "data": {
    "messageId": "msg_456",
    "conversationId": "conv_abc123",
    "content": "...",
    "userId": "user_123"
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { PennyClient } from '@penny/sdk';

const client = new PennyClient({
  apiKey: 'pk_live_abc123',
  baseUrl: 'https://api.penny.ai/v1'
});

// Send a message
const response = await client.chat.sendMessage({
  conversationId: 'conv_abc123',
  content: 'Show me sales data',
  stream: true
});

for await (const chunk of response) {
  if (chunk.type === 'token') {
    process.stdout.write(chunk.content);
  }
}
```

### Python

```python
from penny import PennyClient

client = PennyClient(
    api_key="pk_live_abc123",
    base_url="https://api.penny.ai/v1"
)

# Execute a tool
result = client.tools.execute(
    name="get_company_kpis",
    params={"period": "QTD", "unit": "company"}
)

print(f"Revenue: ${result['revenue']:,.2f}")
```

### cURL

```bash
# Send a message
curl -X POST https://api.penny.ai/v1/chat/conv_abc123/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "What are our top priorities?",
    "stream": false
  }'

# Execute a tool
curl -X POST https://api.penny.ai/v1/tools/load_dashboard/invoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "slug": "company-health"
    }
  }'
```

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

- JSON: https://api.penny.ai/v1/openapi.json
- YAML: https://api.penny.ai/v1/openapi.yaml
- Interactive Docs: https://api.penny.ai/docs

## Support

For API support and questions:

- Email: api-support@penny.ai
- Discord: #api-help channel
- Documentation: https://docs.penny.ai/api
- Status Page: https://status.penny.ai