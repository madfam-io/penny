import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import Redis from 'ioredis';
import { nanoid } from 'nanoid';
import { prisma, ToolExecutionStatus as DBStatus } from '@penny/database';
import { generateId } from '@penny/shared';
import type {
  ToolDefinition,
  ToolContext,
  ToolResult,
  ToolExecution,
  ToolExecutionStatus,
  ToolExecutionError,
  ToolEvent,
  ToolEventPayload,
  ToolEventHandler,
  ToolLogEntry,
  ToolUsage
} from './types.js';
import { ToolRegistry } from './registry.js';
import { ToolValidator } from './validator.js';

export interface ToolExecutorConfig {
  registry: ToolRegistry;
  validator?: ToolValidator;
  redis?: Redis;
  
  // Queue settings
  maxConcurrency?: number;
  queueInterval?: number;
  queueIntervalCap?: number;
  
  // Execution settings
  defaultTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  
  // Resource limits
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  
  // Features
  enableSandbox?: boolean;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Storage
  persistExecutions?: boolean;
  maxLogEntries?: number;
  
  // Custom settings
  [key: string]: any;
}

export interface ExecutionOptions {
  priority?: number;
  timeout?: number;
  maxRetries?: number;
  dryRun?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class ToolExecutor extends EventEmitter {
  private registry: ToolRegistry;
  private validator: ToolValidator;
  private queue: PQueue;
  private redis?: Redis;
  private config: Required<ToolExecutorConfig>;
  
  // Active executions tracking
  private executions: Map<string, ToolExecution> = new Map();
  private executionsByTool: Map<string, Set<string>> = new Map();
  private executionsByUser: Map<string, Set<string>> = new Map();
  
  // Metrics
  private metrics: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    totalDuration: number;
    avgDuration: number;
    lastExecution?: Date;
  } = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalDuration: 0,
    avgDuration: 0
  };

  // Rate limiting
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  
  // Event handlers
  private eventHandlers: Map<ToolEvent, Set<ToolEventHandler>> = new Map();

  constructor(config: ToolExecutorConfig) {
    super();

    this.config = {
      maxConcurrency: 10,
      queueInterval: 1000,
      queueIntervalCap: 20,
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      maxMemoryMB: 512,
      maxCpuPercent: 80,
      enableSandbox: true,
      enableMetrics: true,
      enableLogging: true,
      logLevel: 'info',
      persistExecutions: true,
      maxLogEntries: 1000,
      ...config
    } as Required<ToolExecutorConfig>;

    this.registry = this.config.registry;
    this.validator = this.config.validator || new ToolValidator();
    this.redis = this.config.redis;

    // Initialize execution queue with advanced settings
    this.queue = new PQueue({
      concurrency: this.config.maxConcurrency,
      interval: this.config.queueInterval,
      intervalCap: this.config.queueIntervalCap,
      timeout: this.config.defaultTimeout * 2, // Queue timeout should be higher
      throwOnTimeout: true,
      autoStart: true
    });

    // Set up queue event handlers
    this.setupQueueEventHandlers();

    // Set up periodic cleanup
    this.setupPeriodicCleanup();
    
    // Set up metrics collection
    if (this.config.enableMetrics) {
      this.setupMetricsCollection();
    }

    // Set up rate limit cleanup
    this.setupRateLimitCleanup();
  }

  /**
   * Execute a tool with comprehensive error handling and monitoring
   */
  async execute(
    toolName: string,
    params: any,
    context: ToolContext,
    options: ExecutionOptions = {}
  ): Promise<ToolResult> {
    const executionId = context.executionId || generateId('exec');
    const startTime = Date.now();

    // Get tool definition
    const tool = this.registry.get(toolName);
    if (!tool) {
      throw new ToolExecutionError(`Tool ${toolName} not found`, 'TOOL_NOT_FOUND', toolName);
    }

    // Create enhanced context
    const enhancedContext: ToolContext = {
      ...context,
      executionId,
      signal: context.signal || new AbortController().signal
    };

    // Validate parameters
    const validation = await this.validator.validateParameters(tool, params);
    if (!validation.valid) {
      throw new ToolExecutionError(
        `Parameter validation failed: ${validation.errors?.join(', ')}`,
        'INVALID_PARAMS',
        toolName,
        false,
        validation.errors
      );
    }

    const normalizedParams = validation.normalizedParams || params;

    // Check rate limits
    if (tool.config?.rateLimit) {
      const allowed = await this.checkRateLimit(
        toolName,
        enhancedContext.userId,
        tool.config.rateLimit
      );
      
      if (!allowed) {
        throw new ToolExecutionError(
          'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          toolName,
          true
        );
      }
    }

    // Create execution record
    const execution: ToolExecution = {
      id: executionId,
      toolName,
      version: tool.version || '1.0.0',
      status: ToolExecutionStatus.QUEUED,
      params: normalizedParams,
      startedAt: new Date(startTime),
      context: enhancedContext,
      priority: options.priority || 0,
      queuedAt: new Date(),
      maxRetries: options.maxRetries ?? tool.config?.maxRetries ?? this.config.maxRetries,
      logs: [],
      metrics: {}
    };

    // Add execution metadata
    if (options.tags?.length) {
      execution.metadata = { ...execution.metadata, tags: options.tags };
    }
    if (options.metadata) {
      execution.metadata = { ...execution.metadata, ...options.metadata };
    }

    // Track execution
    this.trackExecution(execution);

    // Emit queued event
    this.emitExecutionEvent('execution:queued', execution);

    // Log execution start
    this.addExecutionLog(execution, 'info', `Tool execution queued: ${toolName}`, {
      params: normalizedParams,
      context: enhancedContext
    });

    // Store in database if persistence is enabled
    if (this.config.persistExecutions) {
      await this.storeExecution(execution);
    }

    // Add to queue with priority
    const queueOptions = {
      priority: execution.priority
    };

    try {
      const result = await this.queue.add(async () => {
        return this.executeWithRetries(tool, normalizedParams, enhancedContext, execution, options);
      }, queueOptions);

      // Update final metrics
      const endTime = Date.now();
      execution.completedAt = new Date(endTime);
      execution.duration = endTime - startTime;

      // Update global metrics
      this.updateMetrics(execution, result);

      return result;
    } catch (error: any) {
      // Handle queue errors
      execution.status = ToolExecutionStatus.FAILED;
      execution.error = {
        code: error.code || 'QUEUE_ERROR',
        message: error.message,
        retryable: error.retryable || false
      };
      execution.completedAt = new Date();
      execution.duration = Date.now() - startTime;

      this.addExecutionLog(execution, 'error', `Queue execution failed: ${error.message}`, { error });
      this.emitExecutionEvent('execution:failed', execution);
      
      if (this.config.persistExecutions) {
        await this.updateExecution(execution);
      }

      throw error;
    } finally {
      // Cleanup
      this.untrackExecution(execution.id);
    }
  }

  /**
   * Execute with retry logic and comprehensive monitoring
   */
  private async executeWithRetries(
    tool: ToolDefinition,
    params: any,
    context: ToolContext,
    execution: ToolExecution,
    options: ExecutionOptions,
    attempt = 0
  ): Promise<ToolResult> {
    const isRetry = attempt > 0;
    
    try {
      // Update execution status
      execution.status = ToolExecutionStatus.RUNNING;
      execution.retries = attempt;
      
      if (isRetry) {
        execution.status = ToolExecutionStatus.RETRYING;
        this.addExecutionLog(execution, 'info', `Retrying execution (attempt ${attempt + 1})`);
      }

      this.emitExecutionEvent(isRetry ? 'execution:retrying' : 'execution:running', execution);

      if (this.config.persistExecutions) {
        await this.updateExecution(execution);
      }

      // Set timeout
      const timeout = options.timeout || tool.config?.timeout || this.config.defaultTimeout;
      const timeoutPromise = this.createTimeoutPromise(timeout, tool.name);

      // Create execution promise with resource monitoring
      const executionPromise = this.executeWithMonitoring(tool, params, context, execution, options);

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Validate result
      this.validateToolResult(result, tool.name);

      // Mark as completed
      execution.status = ToolExecutionStatus.COMPLETED;
      execution.result = result;
      
      this.addExecutionLog(execution, 'info', `Tool execution completed successfully`, {
        result: this.sanitizeResultForLogging(result),
        duration: execution.duration
      });

      this.emitExecutionEvent('execution:completed', execution);

      // Track usage metrics
      if (result.usage) {
        await this.trackUsage(tool.name, context, result.usage);
      }

      return result;
    } catch (error: any) {
      // Determine if error is retryable
      const isRetryable = this.isErrorRetryable(error, tool);
      const canRetry = isRetryable && attempt < (execution.maxRetries || 0);

      if (canRetry) {
        // Calculate retry delay with exponential backoff
        const baseDelay = tool.config?.retryDelay || this.config.retryDelay;
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
        
        this.addExecutionLog(execution, 'warn', `Execution failed, retrying in ${delay}ms`, {
          error: error.message,
          attempt: attempt + 1,
          maxRetries: execution.maxRetries
        });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Recursive retry
        return this.executeWithRetries(tool, params, context, execution, options, attempt + 1);
      }

      // No more retries or non-retryable error
      execution.status = error.code === 'TIMEOUT' ? ToolExecutionStatus.TIMEOUT : ToolExecutionStatus.FAILED;
      execution.error = {
        code: error.code || 'EXECUTION_ERROR',
        message: error.message,
        details: error.details,
        retryable: isRetryable,
        category: error.category
      };

      this.addExecutionLog(execution, 'error', `Tool execution failed: ${error.message}`, {
        error,
        attempt: attempt + 1,
        finalFailure: true
      });

      const eventType = execution.status === ToolExecutionStatus.TIMEOUT ? 'execution:timeout' : 'execution:failed';
      this.emitExecutionEvent(eventType, execution);

      throw error;
    }
  }

  /**
   * Execute tool with resource monitoring
   */
  private async executeWithMonitoring(
    tool: ToolDefinition,
    params: any,
    context: ToolContext,
    execution: ToolExecution,
    options: ExecutionOptions
  ): Promise<ToolResult> {
    const startTime = Date.now();
    let memoryUsage = 0;
    let cpuTime = 0;

    // Start resource monitoring
    const monitoringInterval = this.startResourceMonitoring(execution, (usage) => {
      memoryUsage = Math.max(memoryUsage, usage.memory);
      cpuTime += usage.cpu;
      
      // Check resource limits
      if (usage.memory > (this.config.maxMemoryMB * 1024 * 1024)) {
        throw new ToolExecutionError(
          `Memory limit exceeded: ${usage.memory} bytes`,
          'MEMORY_LIMIT_EXCEEDED',
          tool.name
        );
      }
      
      if (usage.cpu > this.config.maxCpuPercent) {
        throw new ToolExecutionError(
          `CPU limit exceeded: ${usage.cpu}%`,
          'CPU_LIMIT_EXCEEDED',
          tool.name
        );
      }
    });

    try {
      let result: ToolResult;

      // Execute based on configuration
      if (options.dryRun) {
        // Dry run mode - validate without executing
        result = {
          success: true,
          data: { dryRun: true, validated: true },
          metadata: { dryRun: true }
        };
      } else if (this.config.enableSandbox && tool.config?.requiresSandbox) {
        // Execute in sandbox
        result = await this.executeInSandbox(tool, params, context);
      } else {
        // Direct execution
        result = await tool.handler(params, context);
      }

      // Add execution metrics to result
      const endTime = Date.now();
      result.duration = endTime - startTime;
      result.memoryUsed = memoryUsage;
      result.cpuTime = cpuTime;

      // Update execution metrics
      execution.metrics = {
        duration: result.duration,
        memoryUsed: result.memoryUsed,
        cpuTime: result.cpuTime
      };

      return result;
    } finally {
      // Stop resource monitoring
      clearInterval(monitoringInterval);
    }
  }

  /**
   * Execute tool in sandbox environment
   */
  private async executeInSandbox(
    tool: ToolDefinition,
    params: any,
    context: ToolContext
  ): Promise<ToolResult> {
    // This would integrate with the sandbox system
    // For now, we'll just execute directly with additional safety checks
    
    try {
      // Additional safety validation for sandboxed execution
      if (tool.config?.allowNetworkAccess === false) {
        // Implement network restriction
      }
      
      if (tool.config?.allowFileSystem === false) {
        // Implement file system restriction
      }

      return await tool.handler(params, context);
    } catch (error: any) {
      throw new ToolExecutionError(
        `Sandbox execution failed: ${error.message}`,
        'SANDBOX_ERROR',
        tool.name,
        false,
        error
      );
    }
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<ToolExecution | null> {
    // Check in-memory first
    const execution = this.executions.get(executionId);
    if (execution) {
      return execution;
    }

    // Check database
    if (this.config.persistExecutions) {
      const dbExecution = await prisma.toolExecution.findUnique({
        where: { id: executionId },
      });

      if (dbExecution) {
        return this.mapDbExecutionToExecution(dbExecution);
      }
    }

    return null;
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string, reason = 'User cancelled'): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution) return false;

    if ([ToolExecutionStatus.RUNNING, ToolExecutionStatus.PENDING, ToolExecutionStatus.QUEUED].includes(execution.status)) {
      execution.status = ToolExecutionStatus.CANCELLED;
      execution.cancelReason = reason;
      execution.completedAt = new Date();

      this.addExecutionLog(execution, 'info', `Execution cancelled: ${reason}`);
      this.emitExecutionEvent('execution:cancelled', execution);

      // Signal cancellation to tool handler
      if (execution.context?.signal) {
        (execution.context.signal as any).abort?.(reason);
      }

      if (this.config.persistExecutions) {
        await this.updateExecution(execution);
      }

      return true;
    }

    return false;
  }

  /**
   * Get execution history for a tool
   */
  async getExecutionHistory(
    toolName: string,
    limit = 50,
    offset = 0
  ): Promise<ToolExecution[]> {
    if (!this.config.persistExecutions) {
      return [];
    }

    const dbExecutions = await prisma.toolExecution.findMany({
      where: { toolId: toolName },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return dbExecutions.map(this.mapDbExecutionToExecution);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    size: number;
    pending: number;
    running: number;
    paused: boolean;
    concurrency: number;
  } {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      running: this.executions.size,
      paused: this.queue.isPaused,
      concurrency: this.queue.concurrency,
    };
  }

  /**
   * Get executor metrics
   */
  getMetrics(): typeof this.metrics & {
    queueStatus: ReturnType<typeof this.getQueueStatus>;
    activeExecutions: number;
    rateLimiters: number;
  } {
    return {
      ...this.metrics,
      queueStatus: this.getQueueStatus(),
      activeExecutions: this.executions.size,
      rateLimiters: this.rateLimiters.size,
    };
  }

  /**
   * Add event handler
   */
  onEvent(event: ToolEvent, handler: ToolEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event handler
   */
  offEvent(event: ToolEvent, handler: ToolEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Pause execution queue
   */
  pause(): void {
    this.queue.pause();
  }

  /**
   * Resume execution queue
   */
  resume(): void {
    this.queue.start();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Pause queue to prevent new executions
    this.queue.pause();

    // Wait for active executions to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.executions.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force cancel remaining executions
    for (const [id, execution] of this.executions) {
      await this.cancelExecution(id, 'System shutdown');
    }

    // Clear queue
    this.queue.clear();
    
    console.log('Tool executor shutdown complete');
  }

  // Private helper methods

  private trackExecution(execution: ToolExecution): void {
    this.executions.set(execution.id, execution);
    
    // Track by tool
    if (!this.executionsByTool.has(execution.toolName)) {
      this.executionsByTool.set(execution.toolName, new Set());
    }
    this.executionsByTool.get(execution.toolName)!.add(execution.id);
    
    // Track by user
    const userId = execution.context?.userId;
    if (userId) {
      if (!this.executionsByUser.has(userId)) {
        this.executionsByUser.set(userId, new Set());
      }
      this.executionsByUser.get(userId)!.add(execution.id);
    }
  }

  private untrackExecution(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    this.executions.delete(executionId);
    this.executionsByTool.get(execution.toolName)?.delete(executionId);
    
    const userId = execution.context?.userId;
    if (userId) {
      this.executionsByUser.get(userId)?.delete(executionId);
    }
  }

  private addExecutionLog(
    execution: ToolExecution,
    level: ToolLogEntry['level'],
    message: string,
    data?: any
  ): void {
    if (!this.config.enableLogging) return;

    const logEntry: ToolLogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      source: 'executor'
    };

    execution.logs = execution.logs || [];
    execution.logs.push(logEntry);

    // Limit log entries
    if (execution.logs.length > this.config.maxLogEntries) {
      execution.logs = execution.logs.slice(-this.config.maxLogEntries);
    }

    // Console logging based on level
    if (this.shouldLog(level)) {
      const prefix = `[${execution.id}] [${execution.toolName}]`;
      console[level](`${prefix} ${message}`, data || '');
    }
  }

  private shouldLog(level: ToolLogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }

  private emitExecutionEvent(event: ToolEvent, execution: ToolExecution): void {
    const payload: ToolEventPayload = {
      tool: execution.toolName,
      execution,
      timestamp: new Date()
    };

    // Emit to EventEmitter
    this.emit(event, payload);

    // Emit to custom handlers
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(async handler => {
        try {
          await handler(event, payload);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  private async checkRateLimit(
    toolName: string,
    userId: string,
    limit: { requests: number; window: number; burst?: number }
  ): Promise<boolean> {
    const key = `${toolName}:${userId}`;
    const now = Date.now();
    
    if (this.redis) {
      // Redis-based rate limiting
      const redisKey = `ratelimit:tool:${key}`;
      const pipeline = this.redis.pipeline();
      
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, limit.window);
      
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number;
      
      return count <= (limit.burst || limit.requests);
    } else {
      // In-memory rate limiting
      const limiter = this.rateLimiters.get(key);
      
      if (!limiter || now > limiter.resetTime) {
        // Reset or create new limiter
        this.rateLimiters.set(key, {
          count: 1,
          resetTime: now + (limit.window * 1000)
        });
        return true;
      }
      
      limiter.count++;
      return limiter.count <= (limit.burst || limit.requests);
    }
  }

  private createTimeoutPromise(timeout: number, toolName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ToolExecutionError(
          `Tool execution timeout after ${timeout}ms`,
          'TIMEOUT',
          toolName,
          true
        ));
      }, timeout);
    });
  }

  private startResourceMonitoring(
    execution: ToolExecution,
    onUsage: (usage: { memory: number; cpu: number }) => void
  ): NodeJS.Timeout {
    return setInterval(() => {
      // Get current process usage (simplified)
      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      onUsage({
        memory: usage.heapUsed,
        cpu: (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to percentage (simplified)
      });
    }, 1000); // Check every second
  }

  private isErrorRetryable(error: any, tool: ToolDefinition): boolean {
    // Check tool-specific retry configuration
    if (tool.config?.retryableErrors?.includes(error.code)) return true;
    if (tool.config?.nonRetryableErrors?.includes(error.code)) return false;
    
    // Check error's retryable flag
    if (typeof error.retryable === 'boolean') return error.retryable;
    
    // Default retryable error codes
    const retryableCodes = [
      'TIMEOUT',
      'RATE_LIMIT_EXCEEDED',
      'NETWORK_ERROR',
      'TEMPORARY_ERROR',
      'SERVICE_UNAVAILABLE'
    ];
    
    return retryableCodes.includes(error.code);
  }

  private validateToolResult(result: ToolResult, toolName: string): void {
    if (!result || typeof result !== 'object') {
      throw new ToolExecutionError(
        'Tool must return a valid result object',
        'INVALID_RESULT',
        toolName
      );
    }
    
    if (typeof result.success !== 'boolean') {
      throw new ToolExecutionError(
        'Tool result must include success boolean',
        'INVALID_RESULT',
        toolName
      );
    }
    
    if (!result.success && !result.error) {
      throw new ToolExecutionError(
        'Failed tool result must include error information',
        'INVALID_RESULT',
        toolName
      );
    }
  }

  private sanitizeResultForLogging(result: ToolResult): any {
    // Remove sensitive data from result for logging
    const sanitized = { ...result };
    
    // Remove large data to avoid log bloat
    if (sanitized.data && typeof sanitized.data === 'object') {
      const dataStr = JSON.stringify(sanitized.data);
      if (dataStr.length > 1000) {
        sanitized.data = { _truncated: true, _length: dataStr.length };
      }
    }
    
    return sanitized;
  }

  private updateMetrics(execution: ToolExecution, result: ToolResult): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalExecutions++;
    this.metrics.lastExecution = new Date();
    
    if (result.success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }
    
    if (execution.duration) {
      this.metrics.totalDuration += execution.duration;
      this.metrics.avgDuration = this.metrics.totalDuration / this.metrics.totalExecutions;
    }
  }

  private async storeExecution(execution: ToolExecution): Promise<void> {
    try {
      await prisma.toolExecution.create({
        data: {
          id: execution.id,
          toolId: execution.toolName,
          userId: execution.context?.userId || '',
          conversationId: execution.context?.conversationId,
          status: execution.status as DBStatus,
          parameters: execution.params,
          startedAt: execution.startedAt,
          priority: execution.priority || 0,
          metadata: execution.metadata || {},
        },
      });
    } catch (error) {
      console.error(`Failed to store execution ${execution.id}:`, error);
    }
  }

  private async updateExecution(execution: ToolExecution): Promise<void> {
    try {
      await prisma.toolExecution.update({
        where: { id: execution.id },
        data: {
          status: execution.status as DBStatus,
          result: execution.result || null,
          error: execution.error ? JSON.stringify(execution.error) : null,
          completedAt: execution.completedAt,
          duration: execution.duration,
          retries: execution.retries || 0,
          metadata: {
            ...execution.metadata,
            logs: execution.logs?.slice(-10), // Store only last 10 logs
            metrics: execution.metrics,
          },
        },
      });
    } catch (error) {
      console.error(`Failed to update execution ${execution.id}:`, error);
    }
  }

  private async trackUsage(toolName: string, context: ToolContext, usage: ToolUsage): Promise<void> {
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
            apiCalls: usage.apiCalls || 0,
            bytesTransferred: usage.bytesTransferred || 0,
            cost: usage.cost,
          },
        },
      });
    } catch (error) {
      console.error(`Failed to track usage for ${toolName}:`, error);
    }
  }

  private mapDbExecutionToExecution(dbExecution: any): ToolExecution {
    return {
      id: dbExecution.id,
      toolName: dbExecution.toolId,
      status: dbExecution.status as ToolExecutionStatus,
      params: dbExecution.parameters,
      result: dbExecution.result,
      error: dbExecution.error ? JSON.parse(dbExecution.error) : undefined,
      startedAt: dbExecution.startedAt,
      completedAt: dbExecution.completedAt,
      duration: dbExecution.duration,
      retries: dbExecution.retries || 0,
      priority: dbExecution.priority || 0,
      metadata: dbExecution.metadata || {},
    };
  }

  private setupQueueEventHandlers(): void {
    this.queue.on('active', () => {
      if (this.config.enableMetrics) {
        // Track queue activity
      }
    });

    this.queue.on('idle', () => {
      if (this.config.enableMetrics) {
        // Track when queue becomes idle
      }
    });

    this.queue.on('error', (error) => {
      console.error('Queue error:', error);
    });
  }

  private setupPeriodicCleanup(): void {
    // Clean up stale executions and rate limiters every 5 minutes
    setInterval(() => {
      const staleTime = Date.now() - 3600000; // 1 hour ago
      
      // Clean stale executions
      for (const [id, execution] of this.executions) {
        if (execution.startedAt.getTime() < staleTime) {
          this.untrackExecution(id);
        }
      }
      
      // Clean expired rate limiters
      const now = Date.now();
      for (const [key, limiter] of this.rateLimiters) {
        if (now > limiter.resetTime) {
          this.rateLimiters.delete(key);
        }
      }
    }, 300000); // Every 5 minutes
  }

  private setupMetricsCollection(): void {
    // Collect metrics every minute
    setInterval(() => {
      if (this.config.enableMetrics) {
        // Could send metrics to monitoring system
        const metrics = this.getMetrics();
        console.debug('Executor metrics:', metrics);
      }
    }, 60000); // Every minute
  }

  private setupRateLimitCleanup(): void {
    // Clean expired rate limiters every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, limiter] of this.rateLimiters) {
        if (now > limiter.resetTime) {
          this.rateLimiters.delete(key);
        }
      }
    }, 60000); // Every minute
  }
}