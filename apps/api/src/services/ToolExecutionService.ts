import { ToolExecutor, ToolRegistry, ToolValidator } from '@penny/tools';\nimport type { ToolContext, ToolResult, ToolExecution } from '@penny/tools';\nimport { prisma } from '@penny/database';\nimport { RBACService } from '@penny/security';\nimport type { TenantId, UserId, Role } from '@penny/shared';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface ExecutionOptions {
  timeout?: number;
  priority?: number;
  dryRun?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class ToolExecutionService extends EventEmitter {
  private executor: ToolExecutor;
  private registry: ToolRegistry;
  private rbac: RBACService;
  private redis?: Redis;

  constructor() {
    super();

    this.registry = new ToolRegistry();
    this.rbac = new RBACService();

    // Initialize Redis if available
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    }

    // Initialize executor with comprehensive configuration
    this.executor = new ToolExecutor({
      registry: this.registry,
      redis: this.redis,\n      maxConcurrency: parseInt(process.env.TOOL_MAX_CONCURRENCY || '10'),\n      defaultTimeout: parseInt(process.env.TOOL_DEFAULT_TIMEOUT || '30000'),\n      maxRetries: parseInt(process.env.TOOL_MAX_RETRIES || '3'),
      enableSandbox: process.env.TOOL_ENABLE_SANDBOX !== 'false',
      enableMetrics: true,
      enableLogging: true,
      persistExecutions: true,
      maxLogEntries: 1000
    });

    // Set up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Execute a tool with comprehensive validation and monitoring
   */
  async executeTool(
    toolName: string,
    params: any,
    context: {
      tenantId: TenantId;
      userId: UserId;
      userRoles: Role[];
      conversationId?: string;
      messageId?: string;
      userAgent?: string;
      ipAddress?: string;
    },
    options: ExecutionOptions = {}
  ): Promise<{ executionId: string; result?: ToolResult; status: string }> {
    const { tenantId, userId, userRoles } = context;

    try {
      // Validate tool existence and permissions
      const tool = this.registry.get(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      // Check execution permissions
      const canExecute = await this.registry.canExecute(toolName, tenantId, userId, userRoles);
      if (!canExecute) {\n        throw new Error(`Insufficient permissions to execute tool ${toolName}`);
      }

      // Check rate limits at service level
      await this.checkServiceRateLimit(toolName, userId, tenantId);

      // Create execution context
      const executionContext: ToolContext = {
        tenantId,
        userId,
        conversationId: context.conversationId,
        messageId: context.messageId,\n        executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        permissions: userRoles.map(role => role.name),
        dryRun: options.dryRun || false
      };

      // Execute the tool
      const result = await this.executor.execute(
        toolName,
        params,
        executionContext,
        {
          timeout: options.timeout,
          priority: options.priority,
          dryRun: options.dryRun,
          tags: options.tags,
          metadata: options.metadata
        }
      );

      // Store execution result
      await this.storeExecutionResult(executionContext.executionId, result);

      // Track usage metrics
      await this.trackToolUsage(toolName, tenantId, userId, result);

      return {
        executionId: executionContext.executionId,
        result,
        status: 'completed'
      };

    } catch (error: any) {
      // Log and track execution failure\n      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await this.storeExecutionError(executionId, toolName, error, context);
      await this.trackToolError(toolName, tenantId, userId, error);
\n      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string, userId: UserId, tenantId: TenantId) {
    try {
      // Check in-memory execution first
      const execution = await this.executor.getExecution(executionId);
      if (execution) {
        return this.formatExecutionStatus(execution);
      }

      // Check database
      const dbExecution = await prisma.toolExecution.findFirst({
        where: {
          id: executionId,
          userId,
          // Ensure user can only access their own executions
        }
      });

      if (!dbExecution) {
        throw new Error('Execution not found');
      }

      return {
        id: dbExecution.id,
        toolName: dbExecution.toolId,
        status: dbExecution.status,
        startedAt: dbExecution.startedAt,
        completedAt: dbExecution.completedAt,
        duration: dbExecution.duration,
        result: dbExecution.result,
        error: dbExecution.error ? JSON.parse(dbExecution.error) : null,
        metadata: dbExecution.metadata
      };
    } catch (error: any) {\n      throw new Error(`Failed to get execution status: ${error.message}`);
    }
  }

  /**
   * Cancel execution
   */
  async cancelExecution(
    executionId: string,
    userId: UserId,
    tenantId: TenantId,
    reason = 'User cancelled'
  ) {
    try {
      // Verify ownership
      const execution = await this.executor.getExecution(executionId);
      if (execution && execution.context?.userId !== userId) {
        throw new Error('Unauthorized to cancel this execution');
      }

      const cancelled = await this.executor.cancelExecution(executionId, reason);
      if (!cancelled) {
        throw new Error('Execution not found or cannot be cancelled');
      }

      return { success: true, message: 'Execution cancelled successfully' };
    } catch (error: any) {\n      throw new Error(`Failed to cancel execution: ${error.message}`);
    }
  }

  /**
   * Get execution history for user
   */
  async getExecutionHistory(
    userId: UserId,
    tenantId: TenantId,
    options: {
      toolName?: string;
      limit?: number;
      offset?: number;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ) {
    try {
      const { toolName, limit = 50, offset = 0, status, dateFrom, dateTo } = options;

      const where: any = {
        userId,
        // Optionally filter by tenant if multi-tenant execution tracking is needed
      };

      if (toolName) where.toolId = toolName;
      if (status) where.status = status;
      if (dateFrom || dateTo) {
        where.startedAt = {};
        if (dateFrom) where.startedAt.gte = dateFrom;
        if (dateTo) where.startedAt.lte = dateTo;
      }

      const executions = await prisma.toolExecution.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return {
        executions: executions.map(exec => ({
          id: exec.id,
          toolName: exec.toolId,
          status: exec.status,
          startedAt: exec.startedAt,
          completedAt: exec.completedAt,
          duration: exec.duration,
          error: exec.error ? JSON.parse(exec.error) : null,
          metadata: exec.metadata
        })),
        total: await prisma.toolExecution.count({ where }),
        hasMore: offset + limit < await prisma.toolExecution.count({ where })
      };
    } catch (error: any) {\n      throw new Error(`Failed to get execution history: ${error.message}`);
    }
  }

  /**
   * Get executor metrics and statistics
   */
  async getExecutorMetrics() {
    return {
      ...this.executor.getMetrics(),
      queueStatus: this.executor.getQueueStatus()
    };
  }

  /**
   * Pause executor (admin only)
   */
  async pauseExecutor() {
    this.executor.pause();
    return { success: true, message: 'Executor paused' };
  }

  /**
   * Resume executor (admin only)
   */
  async resumeExecutor() {
    this.executor.resume();
    return { success: true, message: 'Executor resumed' };
  }

  // Private helper methods

  private setupEventForwarding() {
    // Forward executor events to service events
    const events = [
      'execution:queued',
      'execution:started', 
      'execution:running',
      'execution:completed',
      'execution:failed',
      'execution:cancelled',
      'execution:timeout',
      'execution:retrying'
    ];

    events.forEach(event => {
      this.executor.onEvent(event as any, (eventType, payload) => {
        this.emit(event, payload);
      });
    });
  }

  private async checkServiceRateLimit(toolName: string, userId: string, tenantId: string) {
    if (!this.redis) return; // Skip if Redis not available

    // Implement service-level rate limiting\n    const key = `service_ratelimit:${toolName}:${userId}:${tenantId}`;
    const window = 3600; // 1 hour
    const limit = 1000; // 1000 executions per hour per user per tenant

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      throw new Error('Service rate limit exceeded');
    }
  }

  private async storeExecutionResult(executionId: string, result: ToolResult) {
    try {
      await prisma.toolExecution.update({
        where: { id: executionId },
        data: {
          result: result,
          completedAt: new Date(),
          status: result.success ? 'completed' : 'failed'
        }
      });
    } catch (error) {
      console.error('Failed to store execution result:', error);
    }
  }

  private async storeExecutionError(
    executionId: string,
    toolName: string,
    error: any,
    context: any
  ) {
    try {
      await prisma.toolExecution.create({
        data: {
          id: executionId,
          toolId: toolName,
          userId: context.userId,
          conversationId: context.conversationId,
          status: 'failed',
          error: JSON.stringify({
            message: error.message,
            code: error.code || 'EXECUTION_ERROR',
            stack: error.stack
          }),
          startedAt: new Date(),
          completedAt: new Date(),
          parameters: {},
        }
      });
    } catch (dbError) {
      console.error('Failed to store execution error:', dbError);
    }
  }

  private async trackToolUsage(
    toolName: string,
    tenantId: string,
    userId: string,
    result: ToolResult
  ) {
    try {
      await prisma.usageMetric.create({
        data: {
          tenantId,
          metric: 'tool_execution',
          value: 1,
          unit: 'count',
          metadata: {
            toolName,
            userId,
            success: result.success,
            duration: result.duration || 0,
            credits: result.usage?.credits || 0
          }
        }
      });
    } catch (error) {
      console.error('Failed to track tool usage:', error);
    }
  }

  private async trackToolError(
    toolName: string,
    tenantId: string,
    userId: string,
    error: any
  ) {
    try {
      await prisma.usageMetric.create({
        data: {
          tenantId,
          metric: 'tool_error',
          value: 1,
          unit: 'count',
          metadata: {
            toolName,
            userId,
            errorCode: error.code || 'UNKNOWN',
            errorMessage: error.message
          }
        }
      });
    } catch (dbError) {
      console.error('Failed to track tool error:', dbError);
    }
  }

  private formatExecutionStatus(execution: ToolExecution) {
    return {
      id: execution.id,
      toolName: execution.toolName,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      duration: execution.duration,
      result: execution.result,
      error: execution.error,
      logs: execution.logs?.slice(-10), // Last 10 log entries
      metrics: execution.metrics,
      progress: this.calculateProgress(execution)
    };
  }

  private calculateProgress(execution: ToolExecution): number {
    switch (execution.status) {
      case 'queued':
        return 0;
      case 'pending':
        return 10;
      case 'running':
        return 50;
      case 'completed':
        return 100;
      case 'failed':
      case 'cancelled':
      case 'timeout':
        return 100;
      default:
        return 0;
    }
  }
}

export default ToolExecutionService;