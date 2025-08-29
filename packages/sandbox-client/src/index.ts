/**
 * Sandbox Client SDK
 * TypeScript client for interacting with the PENNY Python sandbox service
 */

export interface ExecutionRequest {
  code: string;
  sessionId?: string;
  timeout?: number;
  packages?: string[];
  variables?: Record<string, any>;
  allowNetworking?: boolean;
  maxMemory?: number;
  maxCpu?: number;
}

export interface ExecutionResult {
  success: boolean;
  sessionId: string;
  executionId: string;
  output: {
    stdout: string;
    stderr: string;
    plots: PlotData[];
    variables: Record<string, VariableData>;
  };
  metrics: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  error?: {
    type: string;
    message: string;
    traceback: string;
  };
}

export interface PlotData {
  id: string;
  format: 'png' | 'svg' | 'html';
  data: string; // base64 encoded
  metadata: {
    width: number;
    height: number;
    title?: string;
    xlabel?: string;
    ylabel?: string;
  };
}

export interface VariableData {
  type: string;
  value: any;
  shape?: number[];
  dtype?: string;
  preview?: string;
  size?: number;
  serializable?: boolean;
  truncated?: boolean;
}

export interface Session {
  id: string;
  createdAt: string;
  lastActivity: string;
  status: 'active' | 'idle' | 'terminated';
  variables: Record<string, any>;
  installedPackages: string[];
  resourceUsage: {
    memory: number;
    cpu: number;
    executions: number;
  };
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  security: {
    allowed: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    violations: string[];
  };
  analysis: {
    complexity: number;
    linesOfCode: number;
    imports: string[];
    functions: string[];
    variables: string[];
    hasHighRiskPatterns: boolean;
    estimatedExecutionTime: number;
  };
  suggestions: Suggestion[];
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
}

export interface Suggestion {
  type: 'performance' | 'security' | 'style' | 'best-practice';
  message: string;
  line?: number;
}

export interface PackageInfo {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  dependencies: string[];
  size: number;
  installed: boolean;
  allowedVersions: string[];
  securityRating: 'safe' | 'caution' | 'restricted' | 'blocked';
  category: string;
}

export interface StreamEvent {
  type: 'stdout' | 'stderr' | 'plot' | 'variable' | 'complete' | 'error';
  data: any;
  timestamp: string;
}

export interface SandboxConfig {
  baseUrl: string;
  timeout?: number;
  apiKey?: string;
  retryAttempts?: number;
  retryDelay?: number;
}

export class SandboxClient {
  private baseUrl: string;
  private timeout: number;
  private apiKey?: string;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: SandboxConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 30000;
    this.apiKey = config.apiKey;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  // Code execution methods
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    return this.request<ExecutionResult>('POST', '/api/v1/execute', request);
  }

  async executeStream(
    request: ExecutionRequest,
    onEvent: (event: StreamEvent) => void
  ): Promise<ExecutionResult> {
    const response = await this.streamRequest('/api/v1/execute/stream', request, onEvent);
    return response;
  }

  // Session management
  async createSession(): Promise<Session> {
    return this.request<Session>('POST', '/api/v1/sessions');
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>('GET', `/api/v1/sessions/${sessionId}`);
  }

  async updateSession(sessionId: string, data: { 
    metadata?: Record<string, any>; 
    variables?: Record<string, any>; 
  }): Promise<Session> {
    return this.request<Session>('PATCH', `/api/v1/sessions/${sessionId}`, data);
  }

  async deleteSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('DELETE', `/api/v1/sessions/${sessionId}`);
  }

  async getSessionVariables(sessionId: string): Promise<{
    sessionId: string;
    variables: Record<string, any>;
    lastUpdated: string;
  }> {
    return this.request('GET', `/api/v1/sessions/${sessionId}/variables`);
  }

  async updateSessionVariables(sessionId: string, variables: Record<string, any>): Promise<{
    sessionId: string;
    variables: Record<string, any>;
    updated: string[];
  }> {
    return this.request('PUT', `/api/v1/sessions/${sessionId}/variables`, variables);
  }

  async clearSessionVariables(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request('DELETE', `/api/v1/sessions/${sessionId}/variables`);
  }

  // Code validation
  async validateCode(code: string, options?: {
    strict?: boolean;
    includeWarnings?: boolean;
  }): Promise<ValidationResult> {
    return this.request<ValidationResult>('POST', '/api/v1/validate', {
      code,
      ...options
    });
  }

  async validateSecurity(code: string): Promise<{
    allowed: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    violations: string[];
    details: {
      blockedImports: string[];
      dangerousPatterns: string[];
      restrictedKeywords: string[];
    };
  }> {
    return this.request('POST', '/api/v1/validate/security', { code });
  }

  async validateSyntax(code: string): Promise<{
    valid: boolean;
    errors: Array<{
      message: string;
      line: number;
      column: number;
      type: string;
    }>;
  }> {
    return this.request('POST', '/api/v1/validate/syntax', { code });
  }

  // Package management
  async getPackages(options?: {
    search?: string;
    category?: string;
    installed?: boolean;
  }): Promise<{
    packages: PackageInfo[];
    total: number;
    categories: string[];
  }> {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);
    if (options?.category) params.append('category', options.category);
    if (options?.installed !== undefined) params.append('installed', options.installed.toString());

    return this.request('GET', `/api/v1/packages?${params.toString()}`);
  }

  async getPackageInfo(packageName: string): Promise<PackageInfo> {
    return this.request<PackageInfo>('GET', `/api/v1/packages/${packageName}`);
  }

  async installPackages(sessionId: string, packages: string[], force = false): Promise<{
    success: boolean;
    installed: string[];
    failed: Array<{ package: string; error: string }>;
    logs: string[];
  }> {
    return this.request('POST', '/api/v1/packages/install', {
      sessionId,
      packages,
      force
    });
  }

  async uninstallPackages(sessionId: string, packages: string[]): Promise<{
    success: boolean;
    uninstalled: string[];
    failed: Array<{ package: string; error: string }>;
    logs: string[];
  }> {
    return this.request('POST', '/api/v1/packages/uninstall', {
      sessionId,
      packages
    });
  }

  async getSessionPackages(sessionId: string): Promise<{
    sessionId: string;
    packages: PackageInfo[];
  }> {
    return this.request('GET', `/api/v1/packages/session/${sessionId}`);
  }

  // Health check
  async getHealth(): Promise<{
    status: string;
    timestamp: string;
    version: string;
    uptime: number;
    system: any;
  }> {
    return this.request('GET', '/health');
  }

  // Private methods
  private async request<T = any>(
    method: string,
    path: string,
    data?: any
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const url = `${this.baseUrl}${path}`;
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const config: RequestInit = {
          method,
          headers,
          signal: AbortSignal.timeout(this.timeout),
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          config.body = JSON.stringify(data);
        }

        const response = await fetch(url, config);

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // Ignore JSON parsing errors for error responses
          }
          throw new Error(errorMessage);
        }

        return await response.json();

      } catch (error) {
        lastError = error as Error;

        if (attempt < this.retryAttempts) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError!;
  }

  private async streamRequest(
    path: string,
    data: any,
    onEvent: (event: StreamEvent) => void
  ): Promise<ExecutionResult> {
    return new Promise(async (resolve, reject) => {
      try {
        const url = `${this.baseUrl}${path}`;
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        };

        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // Ignore JSON parsing errors
          }
          throw new Error(errorMessage);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const eventData = JSON.parse(line.slice(6));
                  const event: StreamEvent = eventData;
                  
                  onEvent(event);

                  if (event.type === 'complete') {
                    resolve(event.data);
                    return;
                  } else if (event.type === 'error') {
                    reject(new Error(event.data.message || 'Stream error'));
                    return;
                  }
                } catch (parseError) {
                  console.warn('Failed to parse event data:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

      } catch (error) {
        reject(error);
      }
    });
  }
}

// Convenience function to create a client
export function createSandboxClient(config: SandboxConfig): SandboxClient {
  return new SandboxClient(config);
}

// Export types and interfaces
export * from './types.js';
export * from './streaming.js';