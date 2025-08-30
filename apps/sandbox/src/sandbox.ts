import { EventEmitter } from 'events';
import { SandboxExecutor, ExecutionRequest, ExecutionResult } from './executor.js';
import { SandboxSecurity } from './security.js';
import { ResourceMonitor } from './utils/resourceMonitor.js';

export interface SandboxConfig {
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  maxMemoryPerSession: number;
  maxSessionDuration: number;
  enableNetworking: boolean;
  allowedPackages: string[];
}

export interface SandboxStats {
  totalExecutions: number;
  activeExecutions: number;
  activeSessions: number;
  totalSessions: number;
  avgExecutionTime: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    disk: number;
  };
}

export class Sandbox extends EventEmitter {
  private executor: SandboxExecutor;
  private security: SandboxSecurity;
  private resourceMonitor: ResourceMonitor;
  private config: SandboxConfig;
  private stats: SandboxStats;

  constructor(config: Partial<SandboxConfig> = {}) {
    super();

    this.config = {
      maxConcurrentExecutions: config.maxConcurrentExecutions || 10,
      defaultTimeout: config.defaultTimeout || 30000,
      maxMemoryPerSession: config.maxMemoryPerSession || 512 * 1024 * 1024,
      maxSessionDuration: config.maxSessionDuration || 30 * 60 * 1000,
      enableNetworking: config.enableNetworking || false,
      allowedPackages: config.allowedPackages || []
    };

    this.stats = {
      totalExecutions: 0,
      activeExecutions: 0,
      activeSessions: 0,
      totalSessions: 0,
      avgExecutionTime: 0,
      resourceUsage: {
        memory: 0,
        cpu: 0,
        disk: 0
      }
    };

    this.security = new SandboxSecurity();
    this.executor = new SandboxExecutor(this.security);
    this.resourceMonitor = new ResourceMonitor();

    this.setupEventHandlers();
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // Check concurrent execution limit
    if (this.stats.activeExecutions >= this.config.maxConcurrentExecutions) {
      throw new Error('Maximum concurrent executions reached');
    }

    // Apply default configuration
    const enrichedRequest: ExecutionRequest = {
      ...request,
      timeout: request.timeout || this.config.defaultTimeout,
      maxMemory: request.maxMemory || this.config.maxMemoryPerSession,
      allowNetworking: request.allowNetworking && this.config.enableNetworking
    };

    this.stats.activeExecutions++;
    this.emit('executionStarted', { request: enrichedRequest });

    const startTime = Date.now();

    try {
      const result = await this.executor.execute(enrichedRequest);
      
      // Update stats
      const executionTime = Date.now() - startTime;
      this.updateExecutionStats(executionTime);
      
      this.emit('executionCompleted', { request: enrichedRequest, result });
      
      return result;

    } catch (error) {
      this.emit('executionError', { request: enrichedRequest, error });
      throw error;

    } finally {
      this.stats.activeExecutions--;
    }
  }

  async executeStream(
    request: ExecutionRequest,
    onOutput: (chunk: { type: 'stdout' | 'stderr' | 'plot' | 'variable'; data: any }) => void
  ): Promise<ExecutionResult> {
    // Similar validation as execute()
    if (this.stats.activeExecutions >= this.config.maxConcurrentExecutions) {
      throw new Error('Maximum concurrent executions reached');
    }

    const enrichedRequest: ExecutionRequest = {
      ...request,
      timeout: request.timeout || this.config.defaultTimeout,
      maxMemory: request.maxMemory || this.config.maxMemoryPerSession,
      allowNetworking: request.allowNetworking && this.config.enableNetworking
    };

    this.stats.activeExecutions++;
    this.emit('executionStarted', { request: enrichedRequest });

    const startTime = Date.now();

    try {
      const result = await this.executor.executeStream(enrichedRequest, (chunk) => {
        this.emit('executionOutput', { request: enrichedRequest, chunk });
        onOutput(chunk);
      });
      
      const executionTime = Date.now() - startTime;
      this.updateExecutionStats(executionTime);
      
      this.emit('executionCompleted', { request: enrichedRequest, result });
      
      return result;

    } catch (error) {
      this.emit('executionError', { request: enrichedRequest, error });
      throw error;

    } finally {
      this.stats.activeExecutions--;
    }
  }

  async createSession(): Promise<string> {
    const sessionId = await this.executor.createSession();
    
    this.stats.activeSessions++;
    this.stats.totalSessions++;
    
    this.emit('sessionCreated', { sessionId });
    
    return sessionId;
  }

  async getSession(sessionId: string) {
    return this.executor.getSession(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.executor.destroySession(sessionId);
    
    this.stats.activeSessions--;
    
    this.emit('sessionDestroyed', { sessionId });
  }

  async validateCode(code: string) {
    return this.security.validateCode(code);
  }

  async installPackage(sessionId: string, packageName: string): Promise<boolean> {
    // Check if package is allowed
    if (this.config.allowedPackages.length > 0 && 
        !this.config.allowedPackages.includes(packageName)) {
      throw new Error(`Package '${packageName}' is not allowed`);
    }

    const session = await this.executor.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    // TODO: Implement package installation in container
    // This would involve running pip install in the session's container
    
    this.emit('packageInstalled', { sessionId, packageName });
    
    return true;
  }

  getStats(): SandboxStats {
    return { ...this.stats };
  }

  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  async getSystemHealth() {
    const systemHealth = await this.resourceMonitor.getSystemHealth();
    
    return {
      status: this.stats.activeExecutions < this.config.maxConcurrentExecutions ? 'healthy' : 'overloaded',
      executions: {
        active: this.stats.activeExecutions,
        total: this.stats.totalExecutions,
        maxConcurrent: this.config.maxConcurrentExecutions
      },
      sessions: {
        active: this.stats.activeSessions,
        total: this.stats.totalSessions
      },
      system: systemHealth,
      timestamp: new Date().toISOString()
    };
  }

  private setupEventHandlers(): void {
    // Set up periodic stats collection
    setInterval(async () => {
      try {
        const resourceUsage = await this.resourceMonitor.getSystemHealth();
        this.stats.resourceUsage = {
          memory: resourceUsage.memory.used,
          cpu: resourceUsage.cpu.usage,
          disk: resourceUsage.disk.used
        };
        
        this.emit('statsUpdated', this.stats);
      } catch (error) {
        this.emit('error', error);
      }
    }, 30000); // Every 30 seconds

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.emit('error', error);
    });

    process.on('unhandledRejection', (reason) => {
      this.emit('error', reason);
    });
  }

  private updateExecutionStats(executionTime: number): void {
    this.stats.totalExecutions++;
    
    // Update average execution time (simple moving average)
    if (this.stats.totalExecutions === 1) {
      this.stats.avgExecutionTime = executionTime;
    } else {
      this.stats.avgExecutionTime = 
        (this.stats.avgExecutionTime * (this.stats.totalExecutions - 1) + executionTime) / 
        this.stats.totalExecutions;
    }
  }

  async cleanup(): Promise<void> {
    this.emit('cleanup');
    
    // Stop periodic stats collection
    this.removeAllListeners();
    
    // Cleanup executor
    await this.executor.cleanup();
    
    this.emit('cleanupComplete');
  }
}