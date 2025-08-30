import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role, toolInvocationSchema } from '@penny/shared';
import { ToolRegistryService } from '../services/ToolRegistryService.js';
import { ToolExecutionService } from '../services/ToolExecutionService.js';

const toolSearchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  featured: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['name', 'category', 'rating', 'usage']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

const toolExecuteSchema = z.object({
  params: z.record(z.any()),
  options: z.object({
    timeout: z.number().min(1000).max(300000).optional(),
    priority: z.number().min(0).max(10).optional(),
    dryRun: z.boolean().default(false),
    tags: z.array(z.string()).optional()
  }).optional()
});

const routes: FastifyPluginAsync = async (fastify) => {
  const toolRegistry = new ToolRegistryService();
  const toolExecutor = new ToolExecutionService();

  // List available tools with search and filtering
  fastify.get(\n    '/',
    {
      schema: {
        description: 'List available tools for the current user with search and filtering',
        tags: ['tools'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            category: { type: 'string' },
            featured: { type: 'boolean' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'number', minimum: 0, default: 0 },
            sortBy: { type: 'string', enum: ['name', 'category', 'rating', 'usage'], default: 'name' },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
          }
        }
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const query = toolSearchSchema.parse(request.query);
      const user = request.user as any;

      try {
        const result = await toolRegistry.searchTools({
          ...query,
          tenantId: user.tenantId,
          userId: user.id,
          userRoles: user.roles
        });

        return {
          success: true,
          data: result,
          meta: {
            total: result.total,
            page: Math.floor(query.offset / query.limit) + 1,
            pageSize: query.limit,
            hasMore: result.hasMore
          }
        };
      } catch (error: any) {
        fastify.log.error(error, 'Failed to search tools');
        reply.code(500);
        return {
          success: false,
          error: {
            code: 'TOOLS_SEARCH_ERROR',
            message: 'Failed to search tools'
          }
        };
      }
    },
  );

  // Invoke a tool
  fastify.post(\n    '/:name/invoke',
    {
      schema: {
        description: 'Invoke a specific tool',
        tags: ['tools'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
      preHandler: [
        fastify.authenticate,
        fastify.authorize([Role.CREATOR, Role.MANAGER, Role.ADMIN]),
      ],
    },
    async (request, reply) => {
      const { name } = request.params as any;
      const body = toolInvocationSchema.parse(request.body);

      // TODO: Implement actual tool execution
      // For now, return mock responses based on tool name

      const runId = 'run_' + Date.now();

      switch (name) {
        case 'get_company_kpis':
          return {
            runId,
            status: 'completed',
            result: {
              period: body.parameters.period,
              unit: body.parameters.unit,
              metrics: {
                revenue: 1250000,
                expenses: 980000,
                profit: 270000,
                customers: 156,
                nps: 72,
              },
            },
          };

        case 'create_jira_ticket':
          return {
            runId,
            status: 'completed',
            result: {
              ticketId: 'PROJ-123',
              url: 'https://company.atlassian.net/browse/PROJ-123',
            },
          };

        case 'run_python_job':
          return {
            runId,
            status: 'completed',
            result: {
              stdout: 'Hello from Python!\n',
              stderr: '',
              artifacts: [],
              exitCode: 0,
            },
          };

        default:
          reply.code(404);
          return {
            error: {
              code: 'TOOL_NOT_FOUND',\n              message: `Tool '${name}' not found`,
            },
          };
      }
    },
  );

  // Get tool execution status
  fastify.get(\n    '/runs/:runId',
    {
      schema: {
        description: 'Get tool execution status',
        tags: ['tools'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            runId: { type: 'string' },
          },
          required: ['runId'],
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const { runId } = request.params as any;

      // TODO: Fetch actual run status from database
      return {
        runId,
        toolName: 'get_company_kpis',
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        result: {
          period: 'MTD',
          unit: 'company',
          metrics: {
            revenue: 1250000,
            expenses: 980000,
            profit: 270000,
          },
        },
      };
    },
  );
};

export default routes;
