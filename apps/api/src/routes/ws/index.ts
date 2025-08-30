import type { FastifyPluginAsync } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '@penny/database';
import { generateId } from '@penny/shared';
import { getJWTService } from '@penny/security';
import { ModelOrchestrator } from '@penny/core';
import { ToolExecutor, ToolRegistry, registerBuiltinTools } from '@penny/core';
import Redis from 'ioredis';

// Initialize services
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const orchestrator = new ModelOrchestrator({
  providers: {
    openai: { apiKey: process.env.OPENAI_API_KEY! },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  },
});

const registry = new ToolRegistry();
registerBuiltinTools(registry);
const toolExecutor = new ToolExecutor({ registry, redis, enableSandbox: true });

// WebSocket message types
const messageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('authenticate'),
    token: z.string(),
  }),
  z.object({
    type: z.literal('message'),
    conversationId: z.string().optional(),
    content: z.string(),
    artifacts: z.array(z.any()).optional(),
  }),
  z.object({
    type: z.literal('tool_execute'),
    tool: z.string(),
    params: z.any(),
  }),
  z.object({
    type: z.literal('typing'),
    conversationId: z.string(),
  }),
  z.object({
    type: z.literal('ping'),
  }),
]);

interface WebSocketClient {
  id: string;
  userId: string;
  tenantId: string;
  conversationId?: string;
  isAuthenticated: boolean;
  subscriber?: Redis;
}

const clients = new Map<any, WebSocketClient>();

const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (connection, request: FastifyRequest) => {
    const client: WebSocketClient = {
      id: generateId('ws'),\n      userId: '',\n      tenantId: '',
      isAuthenticated: false,
    };

    clients.set(connection.socket, client);

    // Send welcome message
    connection.socket.send(
      JSON.stringify({
        type: 'welcome',
        id: client.id,
        timestamp: new Date().toISOString(),
      }),
    );

    connection.socket.on('message', async (rawMessage: Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        const parsed = messageSchema.parse(message);

        switch (parsed.type) {
          case 'authenticate': {
            try {
              // Verify JWT token
              const jwtService = getJWTService();
              const payload = await jwtService.verifyToken(parsed.token);

              // Update client info
              client.userId = payload.userId;
              client.tenantId = payload.tenantId;
              client.isAuthenticated = true;

              connection.socket.send(
                JSON.stringify({
                  type: 'authenticated',
                  userId: client.userId,
                  timestamp: new Date().toISOString(),
                }),
              );

              // Subscribe to Redis channels for real-time updates
              const subscriber = redis.duplicate();
              await subscriber.subscribe(`user:${client.userId}`, `tenant:${client.tenantId}`);

              subscriber.on('message', (channel, message) => {
                if (connection.socket.readyState === connection.socket.OPEN) {
                  connection.socket.send(message);
                }
              });

              // Store subscriber reference for cleanup
              client.subscriber = subscriber;
            } catch (error) {
              connection.socket.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Authentication failed',
                }),
              );
              connection.socket.close();
            }
            break;
          }

          case 'message': {
            if (!client.isAuthenticated) {
              connection.socket.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Not authenticated',
                }),
              );
              return;
            }

            // Get or create conversation
            let conversationId = parsed.conversationId;
            if (!conversationId) {
              const conversation = await prisma.conversation.create({
                data: {
                  userId: client.userId,
                  tenantId: client.tenantId,
                  title: parsed.content.slice(0, 50),
                },
              });
              conversationId = conversation.id;
              client.conversationId = conversationId;
            }

            // Create user message
            const userMessage = await prisma.message.create({
              data: {
                conversationId,
                role: 'user',
                content: parsed.content,
                artifacts: parsed.artifacts || [],
              },
            });

            // Send acknowledgment
            connection.socket.send(
              JSON.stringify({
                type: 'message_received',
                messageId: userMessage.id,
                conversationId,
                timestamp: new Date().toISOString(),
              }),
            );

            // Start streaming response
            const assistantMessageId = generateId('msg');
            let fullContent = '';
            let artifacts: any[] = [];

            try {
              // Send typing indicator
              connection.socket.send(
                JSON.stringify({
                  type: 'assistant_typing',
                  conversationId,
                }),
              );

              // Get conversation context with user information
              const recentMessages = await prisma.message.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              });

              // Generate response
              const response = await orchestrator.generateCompletion({
                messages: recentMessages.reverse().map((m) => ({
                  role: m.role as 'user' | 'assistant',
                  content: m.content,
                })),
                stream: true,
                tenantId: client.tenantId,
                userId: client.userId,
              });

              // Stream chunks
              for await (const chunk of response.stream!) {
                if (chunk.content) {
                  fullContent += chunk.content;
                  connection.socket.send(
                    JSON.stringify({
                      type: 'assistant_chunk',
                      messageId: assistantMessageId,
                      conversationId,
                      content: chunk.content,
                    }),
                  );
                }

                if (chunk.tools) {
                  // Execute tools
                  for (const tool of chunk.tools) {
                    const result = await toolExecutor.execute(tool.name, tool.params, {
                      tenantId: client.tenantId,
                      userId: client.userId,
                      conversationId,
                      messageId: assistantMessageId,
                    });

                    if (result.artifacts) {
                      artifacts.push(...result.artifacts);
                    }

                    connection.socket.send(
                      JSON.stringify({
                        type: 'tool_result',
                        tool: tool.name,
                        result,
                      }),
                    );
                  }
                }
              }

              // Save assistant message
              await prisma.message.create({
                data: {
                  id: assistantMessageId,
                  conversationId,
                  role: 'assistant',
                  content: fullContent,
                  artifacts,
                  metadata: {
                    model: response.model,
                    usage: response.usage,
                  },
                },
              });

              // Send completion
              connection.socket.send(
                JSON.stringify({
                  type: 'assistant_complete',
                  messageId: assistantMessageId,
                  conversationId,
                  timestamp: new Date().toISOString(),
                }),
              );
            } catch (error: any) {
              connection.socket.send(
                JSON.stringify({
                  type: 'error',
                  error: error.message,
                  conversationId,
                }),
              );
            }
            break;
          }

          case 'tool_execute': {
            if (!client.isAuthenticated) {
              connection.socket.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Not authenticated',
                }),
              );
              return;
            }

            try {
              const result = await toolExecutor.execute(parsed.tool, parsed.params, {
                tenantId: client.tenantId,
                userId: client.userId,
                conversationId: client.conversationId,
              });

              connection.socket.send(
                JSON.stringify({
                  type: 'tool_result',
                  tool: parsed.tool,
                  result,
                }),
              );
            } catch (error: any) {
              connection.socket.send(
                JSON.stringify({
                  type: 'error',
                  error: error.message,
                }),
              );
            }
            break;
          }

          case 'typing': {
            if (!client.isAuthenticated) return;

            // Broadcast typing indicator to other users in conversation
            await redis.publish(
              `conversation:${parsed.conversationId}`,
              JSON.stringify({
                type: 'user_typing',
                userId: client.userId,
                conversationId: parsed.conversationId,
              }),
            );
            break;
          }

          case 'ping': {
            connection.socket.send(
              JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
              }),
            );
            break;
          }
        }
      } catch (error: any) {
        connection.socket.send(
          JSON.stringify({
            type: 'error',
            error: error.message || 'Invalid message format',
          }),
        );
      }
    });

    connection.socket.on('close', () => {
      const client = clients.get(connection.socket);
      if (client?.subscriber) {
        client.subscriber.unsubscribe();
        client.subscriber.disconnect();
      }
      clients.delete(connection.socket);
    });

    connection.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      const client = clients.get(connection.socket);
      if (client?.subscriber) {
        client.subscriber.unsubscribe();
        client.subscriber.disconnect();
      }
      clients.delete(connection.socket);
    });
  });
};

export default wsRoutes;
