import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';\nimport { ConversationService } from '../services/ConversationService';\nimport { PaginationSchema, ErrorResponseSchema } from '../schemas/common';

// Request/Response Schemas
const CreateConversationSchema = z.object({
  workspaceId: z.string().optional(),
  title: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateConversationSchema = z.object({
  title: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  isArchived: z.boolean().optional(),
});

const ConversationQuerySchema = z.object({
  workspaceId: z.string().optional(),
  isArchived: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const ConversationResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  metadata: z.record(z.unknown()),
  isArchived: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number().optional(),
  lastMessage: z.object({
    id: z.string(),
    content: z.string(),
    role: z.string(),
    createdAt: z.string(),
  }).optional(),
});

export async function conversationRoutes(fastify: FastifyInstance) {
  const conversationService = new ConversationService();

  // Get all conversations for current user/tenant\n  fastify.get('/conversations', {
    schema: {
      querystring: ConversationQuerySchema,
      response: {
        200: z.object({
          data: z.array(ConversationResponseSchema),
          pagination: PaginationSchema,
        }),
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Conversations'],
      summary: 'List conversations',
      description: 'Get paginated list of conversations for the current user',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const query = ConversationQuerySchema.parse(request.query);
    
    try {
      const result = await conversationService.getConversations({
        tenantId,
        userId,
        ...query,
      });
      
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch conversations');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch conversations',
      });
    }
  });

  // Get single conversation\n  fastify.get('/conversations/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: ConversationResponseSchema.extend({
          messages: z.array(z.object({
            id: z.string(),
            role: z.string(),
            content: z.string(),
            metadata: z.record(z.unknown()),
            tokenCount: z.number(),
            createdAt: z.string(),
          })).optional(),
          artifacts: z.array(z.object({
            id: z.string(),
            type: z.string(),
            name: z.string(),
            createdAt: z.string(),
          })).optional(),
        }),
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Conversations'],
      summary: 'Get conversation',
      description: 'Get a single conversation with optional messages and artifacts',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const includeMessages = request.query?.include?.includes('messages');
    const includeArtifacts = request.query?.include?.includes('artifacts');
    
    try {
      const conversation = await conversationService.getConversation(id, {
        tenantId,
        userId,
        includeMessages,
        includeArtifacts,
      });
      
      if (!conversation) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }
      
      return reply.send(conversation);
    } catch (error) {
      request.log.error(error, 'Failed to fetch conversation');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch conversation',
      });
    }
  });

  // Create new conversation\n  fastify.post('/conversations', {
    schema: {
      body: CreateConversationSchema,
      response: {
        201: ConversationResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Conversations'],
      summary: 'Create conversation',
      description: 'Create a new conversation',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const body = CreateConversationSchema.parse(request.body);
    
    try {
      const conversation = await conversationService.createConversation({
        tenantId,
        userId,
        ...body,
      });
      
      return reply.code(201).send(conversation);
    } catch (error) {
      request.log.error(error, 'Failed to create conversation');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create conversation',
      });
    }
  });

  // Update conversation\n  fastify.put('/conversations/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: UpdateConversationSchema,
      response: {
        200: ConversationResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Conversations'],
      summary: 'Update conversation',
      description: 'Update an existing conversation',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = UpdateConversationSchema.parse(request.body);
    
    try {
      const conversation = await conversationService.updateConversation(id, {
        tenantId,
        userId,
        ...body,
      });
      
      if (!conversation) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }
      
      return reply.send(conversation);
    } catch (error) {
      request.log.error(error, 'Failed to update conversation');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update conversation',
      });
    }
  });

  // Delete conversation (soft delete)\n  fastify.delete('/conversations/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        204: z.null(),
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Conversations'],
      summary: 'Delete conversation',
      description: 'Soft delete a conversation (archive it)',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const deleted = await conversationService.deleteConversation(id, {
        tenantId,
        userId,
      });
      
      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to delete conversation');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete conversation',
      });
    }
  });

  // Archive/unarchive conversation\n  fastify.post('/conversations/:id/archive', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        isArchived: z.boolean(),
      }),
      response: {
        200: ConversationResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Conversations'],
      summary: 'Archive/unarchive conversation',
      description: 'Archive or unarchive a conversation',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { isArchived } = z.object({ isArchived: z.boolean() }).parse(request.body);
    
    try {
      const conversation = await conversationService.updateConversation(id, {
        tenantId,
        userId,
        isArchived,
      });
      
      if (!conversation) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }
      
      return reply.send(conversation);
    } catch (error) {
      request.log.error(error, 'Failed to archive conversation');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to archive conversation',
      });
    }
  });

  // Generate conversation summary\n  fastify.post('/conversations/:id/summarize', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: z.object({
          summary: z.string(),
        }),
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Conversations'],
      summary: 'Generate conversation summary',
      description: 'Generate an AI summary of the conversation',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const summary = await conversationService.generateSummary(id, {
        tenantId,
        userId,
      });
      
      if (!summary) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }
      
      return reply.send({ summary });
    } catch (error) {
      request.log.error(error, 'Failed to generate summary');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate summary',
      });
    }
  });
}