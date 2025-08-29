# PENNY Python Sandbox Service

A secure, isolated Python code execution service for the PENNY platform. Provides Docker-based sandboxing with comprehensive security policies, resource monitoring, and real-time output streaming.

## Features

### Security
- **Docker Container Isolation**: Each session runs in a separate Docker container
- **Import Filtering**: Whitelist/blacklist system for Python modules
- **Resource Limits**: CPU, memory, and execution time constraints
- **Network Isolation**: Configurable network access restrictions
- **File System Security**: Virtual file system with path restrictions
- **Code Analysis**: Static analysis for dangerous patterns

### Execution
- **Session Management**: Persistent sessions with variable state
- **Real-time Streaming**: Server-Sent Events for live output
- **Plot Capture**: Automatic matplotlib/plotly visualization capture
- **Variable Inspection**: Detailed variable information with type analysis
- **Package Management**: Controlled pip package installation

### Monitoring
- **Resource Monitoring**: Real-time CPU, memory, and disk usage
- **Performance Metrics**: Execution time and resource consumption
- **Health Checks**: System health and container status
- **Audit Logging**: Complete execution audit trail

## Quick Start

### Prerequisites

- Node.js 18+
- Docker
- Python 3.11+

### Installation

```bash
# Install dependencies
npm install

# Build the service
npm run build

# Build Docker image
npm run docker:build

# Start the service
npm start
```

### Development

```bash
# Start in development mode with hot reload
npm run dev

# Run tests
npm test

# Run with Docker in development
npm run docker:dev
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Basic settings
SANDBOX_PORT=3003
NODE_ENV=development

# Security settings
MAX_MEMORY_PER_SESSION=536870912  # 512MB
MAX_EXECUTION_TIME=30000          # 30 seconds
ENABLE_NETWORKING=false

# Docker settings
DOCKER_IMAGE=penny-sandbox:latest
```

## API Reference

### Execute Code

```bash
POST /api/v1/execute
Content-Type: application/json

{
  "code": "import numpy as np\nprint(np.array([1, 2, 3]))",
  "sessionId": "optional-session-id",
  "timeout": 30000,
  "packages": ["numpy"],
  "variables": {"x": 42}
}
```

### Stream Execution

```bash
POST /api/v1/execute/stream
Accept: text/event-stream

# Returns Server-Sent Events with real-time output
```

### Session Management

```bash
# Create session
POST /api/v1/sessions

# Get session
GET /api/v1/sessions/{sessionId}

# Update session variables
PUT /api/v1/sessions/{sessionId}/variables

# Delete session
DELETE /api/v1/sessions/{sessionId}
```

### Code Validation

```bash
POST /api/v1/validate
{
  "code": "print('hello world')",
  "strict": true,
  "includeWarnings": true
}
```

### Package Management

```bash
# Install packages
POST /api/v1/packages/install
{
  "sessionId": "session-id",
  "packages": ["pandas", "matplotlib"],
  "force": false
}

# List available packages
GET /api/v1/packages?search=numpy&category=data-science
```

## Security Policies

### Import Policy (`src/policies/imports.json`)

```json
{
  "allowed": ["numpy", "pandas", "matplotlib"],
  "blocked": ["os", "sys", "subprocess"],
  "restricted": {
    "builtins": {
      "allowed": ["print", "len", "range"],
      "blocked": ["eval", "exec", "__import__"]
    }
  }
}
```

### Resource Limits (`src/policies/resources.json`)

```json
{
  "memory": {
    "maxMemoryPerSession": 536870912
  },
  "cpu": {
    "maxCpuPercentage": 50,
    "maxExecutionTime": 30000
  },
  "storage": {
    "maxFileSize": 10485760,
    "maxTotalStorage": 104857600
  }
}
```

### File System Policy (`src/policies/filesystem.json`)

```json
{
  "allowedPaths": ["/tmp", "/workspace"],
  "blockedPaths": ["/etc", "/root", "/home"],
  "readOnlyPaths": ["/usr", "/lib"]
}
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Sandbox API    │    │ Docker Container│
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ CodeEditor  │ │◄──►│ │  Executor   │ │◄──►│ │   Python    │ │
│ │ OutputPanel │ │    │ │  Security   │ │    │ │  Runtime    │ │
│ │ PlotViewer  │ │    │ │  Monitor    │ │    │ │             │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

- **SandboxExecutor**: Manages code execution in Docker containers
- **SandboxSecurity**: Enforces security policies and validation
- **ResourceMonitor**: Tracks system and container resource usage
- **CodeAnalyzer**: Performs static analysis of Python code
- **OutputCapture**: Handles real-time output streaming
- **VirtualFileSystem**: Provides secure file system access

### Python Runtime

The Python runtime (`python/`) includes:

- **runtime.py**: Main execution environment with security hooks
- **sandbox_env.py**: Secure environment setup and module filtering
- **import_hook.py**: Custom import mechanism with restrictions
- **output_handler.py**: Output capture and variable serialization

## Client SDK

TypeScript client for easy integration:

```typescript
import { SandboxClient } from '@penny/sandbox-client';

const client = new SandboxClient({
  baseUrl: 'http://localhost:3003'
});

// Execute code
const result = await client.execute({
  code: 'print("Hello, World!")',
  timeout: 30000
});

// Stream execution
const stream = await client.executeStream({
  code: 'for i in range(10): print(i)'
}, (event) => {
  console.log(event.type, event.data);
});
```

## UI Components

React components for web integration:

- **CodeEditor**: Monaco-based Python code editor
- **OutputPanel**: Tabbed output display with plots and variables
- **VariableInspector**: Interactive variable browser
- **PlotViewer**: Matplotlib/Plotly plot visualization

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage

# Load testing
npm run test:load
```

## Deployment

### Docker

```bash
# Build production image
docker build -t penny-sandbox:latest .

# Run container
docker run -d \
  --name penny-sandbox \
  --memory=1g \
  --cpus=1 \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  -p 3003:3003 \
  penny-sandbox:latest
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandbox-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sandbox-service
  template:
    metadata:
      labels:
        app: sandbox-service
    spec:
      containers:
      - name: sandbox
        image: penny-sandbox:latest
        ports:
        - containerPort: 3003
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
```

## Security Considerations

1. **Container Isolation**: Each execution runs in a separate Docker container
2. **Resource Limits**: Strict CPU, memory, and time constraints
3. **Network Isolation**: No network access by default
4. **Import Restrictions**: Only whitelisted modules can be imported
5. **File System Sandboxing**: Limited file system access
6. **Code Analysis**: Static analysis prevents dangerous patterns
7. **Audit Logging**: All executions are logged for security review

## Performance

- **Concurrent Sessions**: Up to 50 sessions per instance
- **Memory Usage**: ~512MB per active session
- **Startup Time**: ~2-3 seconds for new containers
- **Throughput**: ~100 executions per minute per instance

## Monitoring

Health check endpoint:

```bash
GET /health
{
  "status": "healthy",
  "uptime": 3600,
  "sessions": {
    "active": 5,
    "total": 23
  },
  "system": {
    "memory": 75.2,
    "cpu": 23.1,
    "disk": 45.8
  }
}
```

Metrics endpoint (if enabled):

```bash
GET /metrics
# Prometheus-compatible metrics
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run security checks
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Documentation: [docs.penny.ai/sandbox](https://docs.penny.ai/sandbox)
- Issues: [GitHub Issues](https://github.com/penny-ai/penny/issues)
- Security: [security@penny.ai](mailto:security@penny.ai)