import type { FastifyPluginAsync } from 'fastify';
import { Role, createArtifactSchema } from '@penny/shared';

const routes: FastifyPluginAsync = async (fastify) => {
  // List artifacts
  fastify.get(\n    '/',
    {
      schema: {
        description: 'List artifacts',
        tags: ['artifacts'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            conversationId: { type: 'string' },
            type: { type: 'string' },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            offset: { type: 'number', minimum: 0 },
          },
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const { conversationId, type, limit = 20, offset = 0 } = request.query as any;

      // TODO: Fetch from database
      return {
        artifacts: [
          {
            id: 'art_1',
            type: 'application/vnd.penny.chart+json',
            name: 'Company KPIs - MTD',
            conversationId: 'conv_123',
            createdAt: new Date().toISOString(),
            metadata: {
              chartType: 'bar',
              period: 'MTD',
            },
          },
        ],
        total: 1,
        limit,
        offset,
      };
    },
  );

  // Create artifact
  fastify.post(\n    '/',
    {
      schema: {
        description: 'Create a new artifact',
        tags: ['artifacts'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        fastify.authenticate,
        fastify.authorize([Role.CREATOR, Role.MANAGER, Role.ADMIN]),
      ],
    },
    async (request, reply) => {
      const body = createArtifactSchema.parse(request.body);

      // TODO: Store in database and object storage
      const artifactId = 'art_' + Date.now();

      reply.code(201);
      return {
        id: artifactId,
        type: body.type,
        name: body.name,
        conversationId: body.conversationId,
        url: `https://storage.penny.ai/artifacts/${artifactId}`,
        createdAt: new Date().toISOString(),
        metadata: body.metadata || {},
      };
    },
  );

  // Get artifact
  fastify.get(
    '/:artifactId',
    {
      schema: {
        description: 'Get artifact details',
        tags: ['artifacts'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            artifactId: { type: 'string' },
          },
          required: ['artifactId'],
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const { artifactId } = request.params as any;

      // TODO: Fetch from database
      return {
        id: artifactId,
        type: 'application/vnd.penny.chart+json',
        name: 'Mock Chart',
        conversationId: 'conv_123',\n        url: `https://storage.penny.ai/artifacts/${artifactId}`,
        createdAt: new Date().toISOString(),
        metadata: {
          chartType: 'line',
          dataPoints: 30,
        },
      };
    },
  );

  // Get artifact content
  fastify.get(
    '/:artifactId/content',
    {
      schema: {
        description: 'Get artifact content (redirects to storage URL)',
        tags: ['artifacts'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            artifactId: { type: 'string' },
          },
          required: ['artifactId'],
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const { artifactId } = request.params as any;

      // TODO: Generate signed URL for object storage\n      const signedUrl = `https://storage.penny.ai/artifacts/${artifactId}?token=mock`;

      reply.redirect(302, signedUrl);
    },
  );

  // Delete artifact
  fastify.delete(\n    '/:artifactId',
    {
      schema: {
        description: 'Delete an artifact',
        tags: ['artifacts'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            artifactId: { type: 'string' },
          },
          required: ['artifactId'],
        },
      },
      preHandler: [fastify.authenticate, fastify.authorize([Role.MANAGER, Role.ADMIN])],
    },
    async (request, reply) => {
      const { artifactId } = request.params as any;

      // TODO: Delete from database and object storage
      reply.code(204);
    },
  );
};

export default routes;
