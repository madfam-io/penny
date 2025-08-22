import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import Redis from 'ioredis';
import { prisma, ToolExecutionStatus as DBStatus } from '@penny/database';
import { generateId } from '@penny/shared';
import type {
  ToolDefinition,
  ToolContext,
  ToolResult,
  ToolExecution,
  ToolExecutionStatus,
  ToolExecutionError,
} from './types.js';
import { ToolRegistry } from './registry.js';
import { ToolSandbox } from './sandbox.js';

export interface ToolExecutorConfig {
  registry: ToolRegistry;
  redis?: Redis;
  maxConcurrency?: number;
  defaultTimeout?: number;
  enableSandbox?: boolean;
}

export class ToolExecutor extends EventEmitter {
  private registry: ToolRegistry;
  private queue: PQueue;
  private redis?: Redis;
  private sandbox?: ToolSandbox;
  private executions: Map<string, ToolExecution> = new Map();
  private defaultTimeout: number;

  constructor(config: ToolExecutorConfig) {
    super();
    
    this.registry = config.registry;
    this.redis = config.redis;
    this.defaultTimeout = config.defaultTimeout || 30000;
    
    // Initialize execution queue
    this.queue = new PQueue({
      concurrency: config.maxConcurrency || 5,
      interval: 1000,
      intervalCap: 10,
    });
    
    // Initialize sandbox if enabled
    if (config.enableSandbox) {
      this.sandbox = new ToolSandbox();
    }
    
    // Set up periodic cleanup for stale executions
    this.setupExecutionCleanup();
  }

  async execute(
    toolName: string,
    params: any,
    context: ToolContext,
  ): Promise<ToolResult> {
    const executionId = generateId('exec');
    
    // Get tool definition
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new ToolExecutionError(
        `Tool ${toolName} not found`,
        'TOOL_NOT_FOUND',
        toolName,
      );
    }
    
    // Validate parameters
    try {
      params = tool.schema.parse(params);
    } catch (error: any) {
      throw new ToolExecutionError(
        'Invalid parameters',
        'INVALID_PARAMS',
        toolName,
        false,
        error.errors,
      );
    }
    
    // Check rate limits
    if (tool.config?.rateLimit) {
      const allowed = await this.checkRateLimit(
        toolName,
        context.userId,
        tool.config.rateLimit,
      );
      
      if (!allowed) {
        throw new ToolExecutionError(
          'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          toolName,
          true,
        );
      }
    }
    
    // Create execution record
    const execution: ToolExecution = {
      id: executionId,
      toolName,
      status: ToolExecutionStatus.PENDING,
      params,
      startedAt: new Date(),
    };
    
    this.executions.set(executionId, execution);
    this.emit('execution:started', execution);
    
    // Store in database
    await this.storeExecution(execution, context);
    
    // Execute in queue
    return this.queue.add(async () => {
      try {
        // Update status
        execution.status = ToolExecutionStatus.RUNNING;
        this.emit('execution:running', execution);
        
        // Set timeout
        const timeout = tool.config?.timeout || this.defaultTimeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new ToolExecutionError(
              'Tool execution timeout',
              'TIMEOUT',
              toolName,
              true,
            ));
          }, timeout);
        });
        
        // Execute tool
        const resultPromise = this.executeWithRetries(
          tool,
          params,
          context,
          tool.config?.maxRetries || 0,
        );
        
        // Race between execution and timeout
        const result = await Promise.race([resultPromise, timeoutPromise]);
        
        // Update execution record
        execution.status = ToolExecutionStatus.COMPLETED;
        execution.result = result;
        execution.completedAt = new Date();
        execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
        
        this.emit('execution:completed', execution);
        await this.updateExecution(execution, context);
        
        // Track usage
        if (result.usage) {
          await this.trackUsage(toolName, context, result.usage);
        }
        
        return result;
        
      } catch (error: any) {
        // Handle execution error
        execution.status = ToolExecutionStatus.FAILED;
        execution.error = {
          code: error.code || 'EXECUTION_ERROR',
          message: error.message,
          details: error.details,
          retryable: error.retryable,
        };
        execution.completedAt = new Date();
        execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
        
        this.emit('execution:failed', execution);
        await this.updateExecution(execution, context);
        
        throw error;
        
      } finally {
        this.executions.delete(executionId);
      }
    });
  }

  private async executeWithRetries(
    tool: ToolDefinition,
    params: any,
    context: ToolContext,
    maxRetries: number,
    attempt = 0,
  ): Promise<ToolResult> {
    try {
      // Execute in sandbox if available and tool requires it
      if (this.sandbox && tool.config?.requiresSandbox) {
        return await this.sandbox.execute(tool, params, context);
      }
      
      // Direct execution
      return await tool.handler(params, context);
      
    } catch (error: any) {
      // Check if retryable
      const isRetryable = error.retryable !== false && attempt < maxRetries;
      
      if (isRetryable) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry
        return this.executeWithRetries(
          tool,
          params,
          context,
          maxRetries,
          attempt + 1,
        );
      }
      
      throw error;
    }
  }

  private async checkRateLimit(
    toolName: string,
    userId: string,
    limit: { requests: number; window: number },
  ): Promise<boolean> {
    if (!this.redis) {
      // Simple in-memory rate limiting
      return true;
    }
    
    const key = `ratelimit:tool:${toolName}:${userId}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, limit.window);
    }
    
    return current <= limit.requests;
  }

  private async storeExecution(
    execution: ToolExecution,
    context: ToolContext,
  ): Promise<void> {
    try {
      await prisma.toolExecution.create({
        data: {
          id: execution.id,
          toolId: execution.toolName, // This would need to be resolved to actual tool ID
          userId: context.userId,
          conversationId: context.conversationId,
          status: execution.status as DBStatus,
          parameters: execution.params,
          startedAt: execution.startedAt,
        },
      });
    } catch (error) {
      console.error('Failed to store tool execution:', error);
    }
  }

  private async updateExecution(
    execution: ToolExecution,
    context: ToolContext,
  ): Promise<void> {
    try {
      await prisma.toolExecution.update({
        where: { id: execution.id },
        data: {
          status: execution.status as DBStatus,
          result: execution.result,
          error: execution.error ? JSON.stringify(execution.error) : null,
          completedAt: execution.completedAt,
          duration: execution.duration,
          metadata: {
            retries: execution.retries || 0,
          },
        },
      });
    } catch (error) {
      console.error('Failed to update tool execution:', error);
    }
  }

  private async trackUsage(
    toolName: string,
    context: ToolContext,
    usage: any,
  ): Promise<void> {
    try {
      await prisma.usageMetric.create({
        data: {
          tenantId: context.tenantId,
          metric: 'tool_execution',
          value: 1,
          unit: 'count',
          metadata: {
            tool: toolName,
            userId: context.userId,
            credits: usage.credits || 0,
            duration: usage.duration || 0,
          },
        },
      });
    } catch (error) {
      console.error('Failed to track tool usage:', error);
    }
  }

  async getExecution(executionId: string): Promise<ToolExecution | null> {
    // Check in-memory first
    const execution = this.executions.get(executionId);
    if (execution) {
      return execution;
    }
    
    // Check database
    const dbExecution = await prisma.toolExecution.findUnique({
      where: { id: executionId },
    });
    
    if (!dbExecution) {
      return null;
    }
    
    return {
      id: dbExecution.id,
      toolName: dbExecution.toolId, // This would need proper mapping
      status: dbExecution.status as ToolExecutionStatus,
      params: dbExecution.parameters as any,
      result: dbExecution.result as any,
      error: dbExecution.error ? JSON.parse(dbExecution.error) : undefined,
      startedAt: dbExecution.startedAt,
      completedAt: dbExecution.completedAt || undefined,
      duration: dbExecution.duration || undefined,
    };
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return false;
    }
    
    if (execution.status === ToolExecutionStatus.RUNNING) {
      execution.status = ToolExecutionStatus.CANCELLED;
      this.emit('execution:cancelled', execution);
      return true;
    }
    
    return false;
  }

  getQueueStatus(): {
    size: number;
    pending: number;
    running: number;
  } {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      running: this.executions.size,
    };
  }

  private setupExecutionCleanup(): void {
    // Clean up stale executions every 5 minutes
    setInterval(() => {
      const staleTime = Date.now() - 3600000; // 1 hour ago
      
      for (const [id, execution] of this.executions) {
        if (execution.startedAt.getTime() < staleTime) {
          console.warn(`Cleaning up stale execution: ${id}`);
          this.executions.delete(id);
        }
      }
    }, 300000); // Every 5 minutes
  }
}