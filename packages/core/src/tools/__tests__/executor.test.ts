import { ToolExecutor } from '../executor';
import { ToolRegistry } from '../registry';
import { ToolExecutionError } from '../types';
import { generateId } from '@penny/shared';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('ioredis');
jest.mock('@penny/database', () => ({
  prisma: {
    toolExecution: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    usageMetric: {
      create: jest.fn(),
    },
  },
  ToolExecutionStatus: {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
  },
}));
jest.mock('@penny/shared', () => ({
  generateId: jest.fn(() => 'test-id'),
}));

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let registry: ToolRegistry;
  let mockRedis: jest.Mocked<Redis>;

  const mockTool = {
    name: 'test_tool',
    displayName: 'Test Tool',
    description: 'A test tool',
    category: 'test',
    schema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    },
    handler: jest.fn().mockResolvedValue({
      success: true,
      data: { result: 'test result' },
    }),
    config: {
      requiresAuth: true,
      timeout: 5000,
      maxRetries: 2,
      rateLimit: {
        requests: 10,
        window: 60,
      },
    },
  };

  const mockContext = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    conversationId: 'conv-789',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    registry = new ToolRegistry();
    registry.register(mockTool);
    
    mockRedis = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    } as any;

    executor = new ToolExecutor({
      registry,
      redis: mockRedis,
      maxConcurrency: 5,
      defaultTimeout: 30000,
      enableSandbox: false,
    });
  });

  describe('execute', () => {
    it('should execute a tool successfully', async () => {
      const result = await executor.execute('test_tool', { input: 'test' }, mockContext);

      expect(result).toEqual({
        success: true,
        data: { result: 'test result' },
      });
      expect(mockTool.handler).toHaveBeenCalledWith(
        { input: 'test' },
        mockContext
      );
    });

    it('should throw error for non-existent tool', async () => {
      await expect(
        executor.execute('non_existent', {}, mockContext)
      ).rejects.toThrow('Tool non_existent not found');
    });

    it('should validate parameters', async () => {
      await expect(
        executor.execute('test_tool', {}, mockContext)
      ).rejects.toThrow('Invalid parameters');
    });

    it('should check rate limits', async () => {
      mockRedis.incr.mockResolvedValueOnce(11); // Exceed rate limit

      await expect(
        executor.execute('test_tool', { input: 'test' }, mockContext)
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle tool execution timeout', async () => {
      const slowTool = {
        ...mockTool,
        name: 'slow_tool',
        handler: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 10000))
        ),
        config: {
          ...mockTool.config,
          timeout: 100, // Very short timeout
        },
      };

      registry.register(slowTool);

      await expect(
        executor.execute('slow_tool', { input: 'test' }, mockContext)
      ).rejects.toThrow('Tool execution timeout');
    });

    it('should retry on failure', async () => {
      const retryTool = {
        ...mockTool,
        name: 'retry_tool',
        handler: jest.fn()
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({ success: true, data: 'success' }),
      };

      registry.register(retryTool);

      const result = await executor.execute('retry_tool', { input: 'test' }, mockContext);

      expect(result).toEqual({ success: true, data: 'success' });
      expect(retryTool.handler).toHaveBeenCalledTimes(2);
    });

    it('should track usage metrics', async () => {
      const { prisma } = require('@penny/database');
      
      const toolWithUsage = {
        ...mockTool,
        name: 'usage_tool',
        handler: jest.fn().mockResolvedValue({
          success: true,
          data: 'result',
          usage: {
            credits: 5,
            duration: 1000,
          },
        }),
      };

      registry.register(toolWithUsage);

      await executor.execute('usage_tool', { input: 'test' }, mockContext);

      expect(prisma.usageMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-456',
          metric: 'tool_execution',
          value: 1,
          unit: 'count',
          metadata: expect.objectContaining({
            tool: 'usage_tool',
            userId: 'user-123',
            credits: 5,
            duration: 1000,
          }),
        }),
      });
    });
  });

  describe('getExecution', () => {
    it('should get execution from memory', async () => {
      // Start an execution to populate memory
      const executionPromise = executor.execute('test_tool', { input: 'test' }, mockContext);
      
      // Get execution while it's in progress
      const execution = await executor.getExecution('test-id');
      
      expect(execution).toBeTruthy();
      expect(execution?.toolName).toBe('test_tool');
      
      await executionPromise; // Clean up
    });

    it('should get execution from database', async () => {
      const { prisma } = require('@penny/database');
      
      prisma.toolExecution.findUnique.mockResolvedValueOnce({
        id: 'exec-123',
        toolId: 'test_tool',
        status: 'completed',
        parameters: { input: 'test' },
        result: { data: 'result' },
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 1000,
      });

      const execution = await executor.getExecution('exec-123');

      expect(execution).toEqual({
        id: 'exec-123',
        toolName: 'test_tool',
        status: 'completed',
        params: { input: 'test' },
        result: { data: 'result' },
        error: undefined,
        startedAt: expect.any(Date),
        completedAt: expect.any(Date),
        duration: 1000,
      });
    });

    it('should return null for non-existent execution', async () => {
      const { prisma } = require('@penny/database');
      prisma.toolExecution.findUnique.mockResolvedValueOnce(null);

      const execution = await executor.getExecution('non-existent');
      
      expect(execution).toBeNull();
    });
  });

  describe('cancelExecution', () => {
    it('should cancel running execution', async () => {
      // Create a long-running execution
      const longTool = {
        ...mockTool,
        name: 'long_tool',
        handler: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 5000))
        ),
      };

      registry.register(longTool);

      // Start execution without awaiting
      const executionPromise = executor.execute('long_tool', { input: 'test' }, mockContext);

      // Wait a bit for execution to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cancel the execution
      const cancelled = await executor.cancelExecution('test-id');
      
      expect(cancelled).toBe(true);

      // Clean up
      try {
        await executionPromise;
      } catch (e) {
        // Expected to fail due to cancellation
      }
    });

    it('should return false for non-existent execution', async () => {
      const cancelled = await executor.cancelExecution('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', () => {
      const status = executor.getQueueStatus();

      expect(status).toEqual({
        size: expect.any(Number),
        pending: expect.any(Number),
        running: expect.any(Number),
      });
    });
  });
});