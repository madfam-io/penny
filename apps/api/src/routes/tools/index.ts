import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { ToolRegistry, ToolExecutor, registerBuiltinTools } from '@penny/core';
import { generateId } from '@penny/shared';
import Redis from 'ioredis';

// Initialize tool infrastructure
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const registry = new ToolRegistry();
registerBuiltinTools(registry);

const executor = new ToolExecutor({
  registry,
  redis,
  maxConcurrency: 10,
  defaultTimeout: 30000,
  enableSandbox: true,
});

const toolRoutes: FastifyPluginAsync = async (fastify) => {
  // List available tools
  fastify.get(\n    '/',
    {
      preHandler: authenticate,
      schema: {
        tags: ['tools'],
        summary: 'List available tools',
        response: {
          200: z.array(
            z.object({
              name: z.string(),
              displayName: z.string(),
              description: z.string(),
              category: z.string(),
              icon: z.string().optional(),
              config: z
                .object({
                  requiresAuth: z.boolean().optional(),
                  requiresConfirmation: z.boolean().optional(),
                  cost: z.number().optional(),
                })
                .optional(),
            }),
          ),
        },
      },
    },
    async (request, reply) => {
      const tools = await registry.listForUser(
        request.user.tenantId,
        request.user.id,
        request.user.roles,
      );

      return tools.map((tool) => ({
        name: tool.name,
        displayName: tool.displayName,
        description: tool.description,
        category: tool.category,
        icon: tool.icon,
        config: {
          requiresAuth: tool.config?.requiresAuth,
          requiresConfirmation: tool.config?.requiresConfirmation,
          cost: tool.config?.cost,
        },
      }));
    },
  );

  // Get tool details
  fastify.get(\n    '/:name',
    {
      preHandler: authenticate,
      schema: {
        tags: ['tools'],
        summary: 'Get tool details',
        params: z.object({
          name: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { name } = request.params as { name: string };

      const canExecute = await registry.canExecute(
        name,
        request.user.tenantId,
        request.user.id,
        request.user.roles,
      );

      if (!canExecute) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'You do not have permission to access this tool',
        });
      }

      const tool = registry.get(name);
      if (!tool) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Tool not found',
        });
      }

      return {
        name: tool.name,
        displayName: tool.displayName,
        description: tool.description,
        category: tool.category,
        icon: tool.icon,
        schema: tool.schema._def,
        config: tool.config,
      };
    },
  );

  // Execute tool
  fastify.post(\n    '/:name/execute',
    {
      preHandler: authenticate,
      schema: {
        tags: ['tools'],
        summary: 'Execute a tool',
        params: z.object({
          name: z.string(),
        }),
        body: z.object({
          params: z.any(),
          conversationId: z.string().optional(),
          messageId: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { name } = request.params as { name: string };
      const { params, conversationId, messageId } = request.body as any;

      // Check permissions
      const canExecute = await registry.canExecute(
        name,
        request.user.tenantId,
        request.user.id,
        request.user.roles,
      );

      if (!canExecute) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'You do not have permission to execute this tool',
        });
      }

      try {
        // Execute tool
        const result = await executor.execute(name, params, {
          tenantId: request.user.tenantId,
          userId: request.user.id,
          conversationId,
          messageId,
        });

        return result;
      } catch (error: any) {
        if (error.code === 'RATE_LIMIT_EXCEEDED') {
          return reply.code(429).send({
            error: 'Too Many Requests',
            message: error.message,
          });
        }

        if (error.code === 'INVALID_PARAMS') {
          return reply.code(400).send({
            error: 'Bad Request',
            message: error.message,
            details: error.details,
          });
        }

        throw error;
      }
    },
  );

  // Get execution status
  fastify.get(\n    '/executions/:id',
    {
      preHandler: authenticate,
      schema: {
        tags: ['tools'],
        summary: 'Get tool execution status',
        params: z.object({
          id: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const execution = await executor.getExecution(id);
      if (!execution) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Execution not found',
        });
      }

      // TODO: Verify user has access to this execution

      return execution;
    },
  );

  // Cancel execution
  fastify.post(\n    '/executions/:id/cancel',
    {
      preHandler: authenticate,
      schema: {
        tags: ['tools'],
        summary: 'Cancel tool execution',
        params: z.object({
          id: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const cancelled = await executor.cancelExecution(id);
      if (!cancelled) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Execution not found or already completed',
        });
      }

      return { success: true };
    },
  );

  // Get queue status (admin only)
  fastify.get(\n    '/queue/status',
    {
      preHandler: authenticate,
      schema: {
        tags: ['tools'],
        summary: 'Get tool queue status',
      },
    },
    async (request, reply) => {
      // Check admin permission
      if (!request.user.roles.includes('admin')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Admin access required',
        });
      }

      return executor.getQueueStatus();
    },
  );
};

export default toolRoutes;
