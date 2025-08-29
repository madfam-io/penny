import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role, toolInvocationSchema } from '@penny/shared';

const routes: FastifyPluginAsync = async (fastify) => {
  // List available tools
  fastify.get(
    '/',
    {
      schema: {
        description: 'List available tools for the current user',
        tags: ['tools'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      // TODO: Filter tools based on user permissions and tenant settings
      return {
        tools: [
          {
            name: 'get_company_kpis',
            description: 'Retrieve company KPIs for a specific period',
            parameters: {
              type: 'object',
              properties: {
                period: { type: 'string', enum: ['MTD', 'QTD', 'YTD'] },
                unit: { type: 'string', enum: ['company', 'bu', 'project'] },
                id: { type: 'string' },
              },
              required: ['period', 'unit'],
            },
            requiresConfirmation: false,
          },
          {
            name: 'create_jira_ticket',
            description: 'Create a new Jira ticket',
            parameters: {
              type: 'object',
              properties: {
                projectKey: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                assignee: { type: 'string' },
                labels: { type: 'array', items: { type: 'string' } },
              },
              required: ['projectKey', 'title', 'description'],
            },
            requiresConfirmation: true,
          },
          {
            name: 'run_python_job',
            description: 'Execute Python code in a sandboxed environment',
            parameters: {
              type: 'object',
              properties: {
                script: { type: 'string' },
                files: { type: 'array', items: { type: 'string' } },
                timeoutSec: { type: 'integer', minimum: 1, maximum: 120 },
              },
              required: ['script'],
            },
            requiresConfirmation: false,
          },
        ],
      };
    },
  );

  // Invoke a tool
  fastify.post(
    '/:name/invoke',
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
              code: 'TOOL_NOT_FOUND',
              message: `Tool '${name}' not found`,
            },
          };
      }
    },
  );

  // Get tool execution status
  fastify.get(
    '/runs/:runId',
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
