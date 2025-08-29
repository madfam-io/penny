# API Reference

PENNY provides a comprehensive REST API for all platform functionality. This document covers
authentication, endpoints, and usage examples.

## Base URL

```
Production: https://api.penny.ai/v1
Development: http://localhost:3000/api/v1
```

## Authentication

PENNY uses JWT (JSON Web Tokens) for API authentication.

### Obtaining a Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["member"]
  }
}
```

### Using the Token

Include the token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Core Endpoints

### Conversations

#### Create Conversation

```http
POST /conversations
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "New Conversation",
  "workspaceId": "ws_123"
}
```

Response:

```json
{
  "id": "conv_123",
  "title": "New Conversation",
  "workspaceId": "ws_123",
  "createdAt": "2024-02-20T10:00:00Z"
}
```

#### List Conversations

```http
GET /conversations?workspaceId=ws_123&limit=20&cursor=xxx
Authorization: Bearer {token}
```

Response:

```json
{
  "conversations": [
    {
      "id": "conv_123",
      "title": "Project Planning",
      "lastMessageAt": "2024-02-20T10:00:00Z",
      "messageCount": 42
    }
  ],
  "nextCursor": "xxx"
}
```

### Messages

#### Send Message

```http
POST /conversations/{conversationId}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "How can I optimize this Python code?",
  "artifacts": [
    {
      "type": "code",
      "language": "python",
      "content": "def calculate(n):\n    return sum(range(n))"
    }
  ]
}
```

Response:

```json
{
  "id": "msg_123",
  "conversationId": "conv_123",
  "role": "user",
  "content": "How can I optimize this Python code?",
  "artifacts": [...],
  "createdAt": "2024-02-20T10:00:00Z"
}
```

#### Stream AI Response

```http
GET /conversations/{conversationId}/messages/stream
Authorization: Bearer {token}
Accept: text/event-stream
```

Response (Server-Sent Events):

```
event: chunk
data: {"content": "Here's an optimized version", "delta": "Here's"}

event: chunk
data: {"content": "Here's an optimized version of", "delta": " an optimized version of"}

event: tool
data: {"tool": "python_executor", "params": {"code": "..."}}

event: complete
data: {"messageId": "msg_124", "usage": {"tokens": 150}}
```

### Tools

#### List Available Tools

```http
GET /tools
Authorization: Bearer {token}
```

Response:

```json
{
  "tools": [
    {
      "name": "get_company_kpis",
      "displayName": "Get Company KPIs",
      "description": "Retrieve key performance indicators",
      "category": "analytics",
      "schema": {
        "type": "object",
        "properties": {
          "startDate": { "type": "string", "format": "date-time" },
          "endDate": { "type": "string", "format": "date-time" },
          "metrics": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    }
  ]
}
```

#### Execute Tool

```http
POST /tools/{toolName}/execute
Authorization: Bearer {token}
Content-Type: application/json

{
  "params": {
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-02-01T00:00:00Z",
    "metrics": ["revenue", "users"]
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "revenue": 125000,
    "users": 450
  },
  "artifacts": [
    {
      "type": "chart",
      "name": "Revenue Trend",
      "content": {...}
    }
  ],
  "usage": {
    "credits": 1,
    "duration": 234
  }
}
```

### Files

#### Upload File

```http
POST /files/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="document.pdf"
Content-Type: application/pdf

[binary data]
------WebKitFormBoundary--
```

Response:

```json
{
  "files": [
    {
      "id": "file_123",
      "filename": "document.pdf",
      "size": 102400,
      "mimeType": "application/pdf",
      "url": "https://storage.penny.ai/files/..."
    }
  ]
}
```

#### List Files

```http
GET /files?folder=documents&limit=20
Authorization: Bearer {token}
```

#### Download File

```http
GET /files/{fileId}/download
Authorization: Bearer {token}
```

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('wss://api.penny.ai/ws');

// Authenticate
ws.send(
  JSON.stringify({
    type: 'authenticate',
    token: 'your-jwt-token',
  }),
);
```

### Message Types

#### Send Message

```json
{
  "type": "message",
  "conversationId": "conv_123",
  "content": "Hello AI!"
}
```

#### Receive Streaming Response

```json
{
  "type": "assistant_chunk",
  "messageId": "msg_124",
  "conversationId": "conv_123",
  "content": "Hello! How"
}
```

#### Tool Execution

```json
{
  "type": "tool_execute",
  "tool": "get_company_kpis",
  "params": {
    "metrics": ["revenue"]
  }
}
```

## Admin API

### Tenants

#### List Tenants

```http
GET /admin/tenants
Authorization: Bearer {admin-token}
```

#### Create Tenant

```http
POST /admin/tenants
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "plan": "enterprise",
  "adminEmail": "admin@acme.com"
}
```

### Users

#### List Users

```http
GET /admin/users?tenantId=tenant_123&status=active
Authorization: Bearer {admin-token}
```

#### Update User Role

```http
PATCH /admin/users/{userId}
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "roles": ["admin"]
}
```

### Billing

#### Get Subscription

```http
GET /admin/tenants/{tenantId}/subscription
Authorization: Bearer {admin-token}
```

#### Update Subscription

```http
PUT /admin/tenants/{tenantId}/subscription
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "plan": "enterprise",
  "seats": 100
}
```

## Rate Limiting

API rate limits are enforced per tenant:

| Plan       | Requests/min | Requests/day | AI Tokens/day |
| ---------- | ------------ | ------------ | ------------- |
| Free       | 20           | 1,000        | 10,000        |
| Starter    | 60           | 10,000       | 100,000       |
| Pro        | 200          | 50,000       | 500,000       |
| Enterprise | Unlimited    | Unlimited    | Custom        |

Rate limit headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1708420800
```

## Error Responses

Standard error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "email": "Invalid email format"
    }
  }
}
```

Common error codes:

- `UNAUTHORIZED` - Invalid or missing token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

## SDK Examples

### JavaScript/TypeScript

```typescript
import { PennyClient } from '@penny/sdk';

const client = new PennyClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.penny.ai/v1',
});

// Send a message
const response = await client.conversations.sendMessage({
  conversationId: 'conv_123',
  content: 'Hello AI!',
});

// Stream response
const stream = await client.conversations.streamMessage({
  conversationId: 'conv_123',
  content: 'Write a story',
});

for await (const chunk of stream) {
  console.log(chunk.delta);
}
```

### Python

```python
from penny import PennyClient

client = PennyClient(
    api_key="your-api-key",
    base_url="https://api.penny.ai/v1"
)

# Send a message
response = client.conversations.send_message(
    conversation_id="conv_123",
    content="Hello AI!"
)

# Execute a tool
result = client.tools.execute(
    tool_name="get_company_kpis",
    params={"metrics": ["revenue", "users"]}
)
```

## Webhooks

Configure webhooks to receive real-time events:

### Event Types

- `conversation.created`
- `message.created`
- `tool.executed`
- `user.created`
- `subscription.updated`

### Webhook Payload

```json
{
  "id": "evt_123",
  "type": "message.created",
  "timestamp": "2024-02-20T10:00:00Z",
  "data": {
    "messageId": "msg_123",
    "conversationId": "conv_123",
    "content": "Hello!"
  }
}
```

### Signature Verification

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```
