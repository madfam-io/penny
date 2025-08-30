import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MessageService } from '../services/MessageService';
import { PaginationSchema, ErrorResponseSchema } from '../schemas/common';

// Request/Response Schemas
const CreateMessageSchema = z.object({
  content: z.string().min(1).max(50000),
  role: z.enum(['user', 'assistant', 'system', 'tool']).default('user'),
  parentMessageId: z.string().optional(),
  toolCalls: z.array(z.object({
    id: z.string(),
    type: z.string(),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const MessageQuerySchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']).optional(),
  parentMessageId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().min(0).default(0),
  before: z.string().optional(), // cursor-based pagination
  after: z.string().optional(),
  search: z.string().optional(),
});

const MessageResponseSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  userId: z.string().nullable(),
  role: z.string(),
  content: z.string(),
  metadata: z.record(z.unknown()),
  parentMessageId: z.string().nullable(),
  toolCalls: z.array(z.object({
    id: z.string(),
    type: z.string(),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).nullable(),
  tokenCount: z.number(),
  createdAt: z.string(),
  replies: z.array(z.object({
    id: z.string(),
    content: z.string().optional(),
    role: z.string(),
    createdAt: z.string(),
  })).optional(),
  artifacts: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    url: z.string().optional(),
  })).optional(),
});

const StreamMessageSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1).max(50000),
  toolsAllowed: z.array(z.string()).optional(),
  artifactsExpected: z.array(z.string()).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function messageRoutes(fastify: FastifyInstance) {
  const messageService = new MessageService();

  // Get messages for a conversation\n  fastify.get('/conversations/:conversationId/messages', {
    schema: {
      params: z.object({
        conversationId: z.string(),
      }),
      querystring: MessageQuerySchema,
      response: {
        200: z.object({
          data: z.array(MessageResponseSchema),
          pagination: PaginationSchema.extend({
            hasMore: z.boolean(),
            nextCursor: z.string().optional(),
            prevCursor: z.string().optional(),
          }),
        }),
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Messages'],
      summary: 'List messages',
      description: 'Get paginated list of messages in a conversation',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { conversationId } = z.object({ conversationId: z.string() }).parse(request.params);
    const query = MessageQuerySchema.parse(request.query);
    
    try {
      // Verify conversation access
      const hasAccess = await messageService.verifyConversationAccess(conversationId, {
        tenantId,
        userId,
      });
      
      if (!hasAccess) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }
      
      const result = await messageService.getMessages(conversationId, query);
      
      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Failed to fetch messages');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch messages',
      });
    }
  });

  // Get single message\n  fastify.get('/messages/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: MessageResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Messages'],
      summary: 'Get message',
      description: 'Get a single message with optional replies and artifacts',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const message = await messageService.getMessage(id, { tenantId, userId });
      
      if (!message) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Message not found',
        });
      }
      
      return reply.send(message);
    } catch (error) {
      request.log.error(error, 'Failed to fetch message');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch message',
      });
    }
  });

  // Create message in conversation\n  fastify.post('/conversations/:conversationId/messages', {
    schema: {
      params: z.object({
        conversationId: z.string(),
      }),
      body: CreateMessageSchema,
      response: {
        201: MessageResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        429: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Messages'],
      summary: 'Create message',
      description: 'Create a new message in a conversation',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { conversationId } = z.object({ conversationId: z.string() }).parse(request.params);
    const body = CreateMessageSchema.parse(request.body);
    
    try {
      // Verify conversation access
      const hasAccess = await messageService.verifyConversationAccess(conversationId, {
        tenantId,
        userId,
      });
      
      if (!hasAccess) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }
      
      const message = await messageService.createMessage({
        conversationId,
        userId,
        ...body,
      });
      
      return reply.code(201).send(message);
    } catch (error) {
      request.log.error(error, 'Failed to create message');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create message',
      });
    }
  });

  // Stream chat completion\n  fastify.post('/conversations/:conversationId/messages/stream', {
    schema: {
      params: z.object({
        conversationId: z.string(),
      }),
      body: StreamMessageSchema,
      response: {
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        429: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Messages'],
      summary: 'Stream message completion',
      description: 'Create a message and stream AI completion response',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { conversationId } = z.object({ conversationId: z.string() }).parse(request.params);
    const body = StreamMessageSchema.parse(request.body);
    
    try {
      // Verify conversation access
      const hasAccess = await messageService.verifyConversationAccess(conversationId, {
        tenantId,
        userId,
      });
      
      if (!hasAccess) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Conversation not found',
        });
      }
      
      // Set headers for Server-Sent Events
      reply.type('text/plain; charset=utf-8');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Headers', 'Cache-Control');
      
      // Start streaming
      const stream = await messageService.streamCompletion({
        conversationId,
        tenantId,
        userId,
        ...body,
      });
      
      return reply.send(stream);
    } catch (error) {
      request.log.error(error, 'Failed to stream message');
      
      // Send error event if streaming already started
      if (reply.sent) {
        reply.raw.write(`event: error
data: {"error": "Stream interrupted"}

`);
        reply.raw.end();
      } else {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to start stream',
        });
      }
    }
  });

  // Update message (edit)
  fastify.put('/messages/:id', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        content: z.string().min(1).max(50000),
        metadata: z.record(z.unknown()).optional(),
      }),
      response: {
        200: MessageResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Messages'],
      summary: 'Update message',
      description: 'Update/edit an existing message',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      content: z.string().min(1).max(50000),
      metadata: z.record(z.unknown()).optional(),
    }).parse(request.body);
    
    try {
      const message = await messageService.updateMessage(id, {
        tenantId,
        userId,
        ...body,
      });
      
      if (!message) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Message not found or not authorized to edit',
        });
      }
      
      return reply.send(message);
    } catch (error) {
      request.log.error(error, 'Failed to update message');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update message',
      });
    }
  });

  // Delete message (soft delete)
  fastify.delete('/messages/:id', {
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
      tags: ['Messages'],
      summary: 'Delete message',
      description: 'Soft delete a message',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const deleted = await messageService.deleteMessage(id, {
        tenantId,
        userId,
      });
      
      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Message not found or not authorized to delete',
        });
      }
      
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Failed to delete message');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete message',
      });
    }
  });

  // Get message thread/replies\n  fastify.get('/messages/:id/thread', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: z.array(MessageResponseSchema),
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Messages'],
      summary: 'Get message thread',
      description: 'Get full thread of message replies',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    
    try {
      const thread = await messageService.getMessageThread(id, {
        tenantId,
        userId,
      });
      
      if (!thread) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Message not found',
        });
      }
      
      return reply.send(thread);
    } catch (error) {
      request.log.error(error, 'Failed to fetch message thread');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch message thread',
      });
    }
  });

  // Regenerate assistant response\n  fastify.post('/messages/:id/regenerate', {
    schema: {
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        model: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().positive().optional(),
      }),
      response: {
        200: MessageResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        429: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
      tags: ['Messages'],
      summary: 'Regenerate response',
      description: 'Regenerate assistant response to a message',
    },
    preHandler: [fastify.authenticate, fastify.tenantIsolation, fastify.rateLimiting],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { tenantId, userId } = request.user;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
    }).parse(request.body);
    
    try {
      const message = await messageService.regenerateResponse(id, {
        tenantId,
        userId,
        ...body,
      });
      
      if (!message) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Message not found or cannot regenerate',
        });
      }
      
      return reply.send(message);
    } catch (error) {
      request.log.error(error, 'Failed to regenerate response');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to regenerate response',
      });
    }
  });
}