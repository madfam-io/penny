import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role, createMessageSchema, type ConversationId } from '@penny/shared';
import type { WebSocket } from 'ws';
import { validateRequest, paginationSchema, idParamSchema } from '../middleware/validation.js';

const routes: FastifyPluginAsync = async (fastify) => {
  // List conversations
  fastify.get(\n    '/',
    {
      schema: {
        description: 'List conversations for the current user',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            page: { type: 'number', minimum: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100 },
            sortBy: { type: 'string' },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
          },
        },
      },
      preHandler: [
        fastify.authenticate,
        validateRequest({
          querystring: paginationSchema.extend({
            workspaceId: z.string().optional(),
          }),
        }),
      ],
    },
    async (request, reply) => {
      const { workspaceId, page, limit, sortBy, sortOrder } = request.query as any;
      const offset = (page - 1) * limit;

      // TODO: Fetch from database
      return {
        conversations: [],
        total: 0,
        limit,
        offset,
      };
    },
  );

  // Create conversation
  const createConversationSchema = z.object({
    workspaceId: z.string(),
    title: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  });

  fastify.post(\n    '/',
    {
      schema: {
        description: 'Create a new conversation',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            title: { type: 'string' },
            metadata: { type: 'object' },
          },
          required: ['workspaceId'],
        },
      },
      preHandler: [
        fastify.authenticate,
        fastify.authorize([Role.CREATOR, Role.MANAGER, Role.ADMIN]),
        validateRequest({ body: createConversationSchema }),
      ],
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createConversationSchema>;

      // TODO: Create in database
      const conversationId = 'conv_' + Date.now();

      reply.code(201);
      return {
        id: conversationId,
        workspaceId: body.workspaceId,
        title: body.title || 'New Conversation',
        metadata: body.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
  );

  // Get conversation
  fastify.get(\n    '/:conversationId',
    {
      schema: {
        description: 'Get conversation details',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            conversationId: { type: 'string' },
          },
          required: ['conversationId'],
        },
      },
      preHandler: [
        fastify.authenticate,
        validateRequest({
          params: z.object({
            conversationId: z.string(),
          }),
        }),
      ],
    },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string };

      // TODO: Fetch from database
      return {
        id: conversationId,
        workspaceId: 'ws_mock',
        title: 'Mock Conversation',
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
  );

  // Send message
  fastify.post(\n    '/:conversationId/messages',
    {
      schema: {
        description: 'Send a message in a conversation',
        tags: ['chat'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            conversationId: { type: 'string' },
          },
          required: ['conversationId'],
        },
      },
      preHandler: [
        fastify.authenticate,
        validateRequest({
          params: z.object({
            conversationId: z.string(),
          }),
          body: createMessageSchema,
        }),
      ],
    },
    async (request, reply) => {
      const { conversationId } = request.params as { conversationId: string };
      const body = request.body as z.infer<typeof createMessageSchema>;

      // TODO: Process message and generate response
      const messageId = 'msg_' + Date.now();

      return {
        id: messageId,
        conversationId,
        role: 'user',
        content: body.content,
        createdAt: new Date().toISOString(),
      };
    },
  );

  // WebSocket endpoint for streaming
  fastify.get(\n    '/:conversationId/stream',
    {
      websocket: true,
      schema: {
        description: 'WebSocket endpoint for streaming chat',
        tags: ['chat'],
        params: {
          type: 'object',
          properties: {
            conversationId: { type: 'string' },
          },
          required: ['conversationId'],
        },
      },
    },
    async (connection, request) => {
      const { conversationId } = request.params as any;
      const socket = connection.socket as WebSocket;

      request.log.info({ conversationId }, 'WebSocket connection established');

      socket.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Echo back for now
          socket.send(
            JSON.stringify({
              type: 'message',
              data: {
                id: 'msg_' + Date.now(),
                content: `Echo: ${message.content}`,
                role: 'assistant',
                timestamp: new Date().toISOString(),
              },
            }),
          );

          // Simulate streaming response
          const words = 'This is a simulated streaming response from the AI assistant.'.split(' ');
          for (const word of words) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            socket.send(
              JSON.stringify({
                type: 'token',
                data: {
                  token: word + ' ',
                },
              }),
            );
          }

          socket.send(
            JSON.stringify({
              type: 'done',
              data: {
                messageId: 'msg_' + Date.now(),
              },
            }),
          );
        } catch (error) {
          request.log.error({ error }, 'WebSocket message error');
          socket.send(
            JSON.stringify({
              type: 'error',
              data: {
                message: 'Failed to process message',
              },
            }),
          );
        }
      });

      socket.on('close', () => {
        request.log.info({ conversationId }, 'WebSocket connection closed');
      });
    },
  );
};

export default routes;
