import { FastifyPluginAsync } from 'fastify';\nimport { Type } from '@sinclair/typebox';\nimport { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const ExecuteRequestSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 50000 }),
  sessionId: Type.Optional(Type.String({ format: 'uuid' })),
  timeout: Type.Optional(Type.Number({ minimum: 1000, maximum: 300000 })), // 1s to 5min
  packages: Type.Optional(Type.Array(Type.String())),
  variables: Type.Optional(Type.Record(Type.String(), Type.Any())),
  allowNetworking: Type.Optional(Type.Boolean()),
  maxMemory: Type.Optional(Type.Number({ minimum: 64 * 1024 * 1024 })), // Min 64MB
  maxCpu: Type.Optional(Type.Number({ minimum: 10, maximum: 100 })) // 10-100% CPU
});

const ExecuteResponseSchema = Type.Object({
  success: Type.Boolean(),
  sessionId: Type.String(),
  executionId: Type.String(),
  output: Type.Object({
    stdout: Type.String(),
    stderr: Type.String(),
    plots: Type.Array(Type.String()),
    variables: Type.Record(Type.String(), Type.Any())
  }),
  metrics: Type.Object({
    executionTime: Type.Number(),
    memoryUsage: Type.Number(),
    cpuUsage: Type.Number()
  }),
  error: Type.Optional(Type.Object({
    type: Type.String(),
    message: Type.String(),
    traceback: Type.String()
  }))
});

const ExecuteStreamResponseSchema = Type.Object({
  type: Type.Union([
    Type.Literal('stdout'),
    Type.Literal('stderr'),
    Type.Literal('plot'),
    Type.Literal('variable'),
    Type.Literal('complete'),
    Type.Literal('error')
  ]),
  data: Type.Any(),
  timestamp: Type.String()
});

const executeRoute: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Execute code synchronously\n  server.post('/', {
    schema: {
      body: ExecuteRequestSchema,
      response: {
        200: ExecuteResponseSchema,
        400: Type.Object({
          error: Type.String(),
          message: Type.String(),
          validationErrors: Type.Optional(Type.Array(Type.Any()))
        }),
        429: Type.Object({
          error: Type.String(),
          message: Type.String()
        }),
        500: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { code, sessionId, timeout, packages, variables, allowNetworking, maxMemory, maxCpu } = request.body;

    try {
      // Rate limiting check
      const clientId = request.headers['x-client-id'] as string || request.ip;
      const rateLimitKey = `execute:${clientId}`;
      
      const result = await server.executor.execute({
        code,
        sessionId,
        timeout,
        packages,
        variables,
        allowNetworking,
        maxMemory,
        maxCpu
      });

      return result;

    } catch (error) {
      server.log.error('Execution error:', error);
      
      if (error.message.includes('Security violation')) {
        return reply.status(400).send({
          error: 'Security Violation',
          message: error.message
        });
      }

      if (error.message.includes('Rate limit')) {
        return reply.status(429).send({
          error: 'Rate Limit Exceeded',
          message: error.message
        });
      }

      return reply.status(500).send({
        error: 'Execution Error',
        message: error.message
      });
    }
  });

  // Execute code with streaming output\n  server.post('/stream', {
    schema: {
      body: ExecuteRequestSchema
    }
  }, async (request, reply) => {
    const { code, sessionId, timeout, packages, variables, allowNetworking, maxMemory, maxCpu } = request.body;

    // Set up Server-Sent Events
    reply.header('Content-Type', 'text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('Access-Control-Allow-Origin', '*');

    try {
      const result = await server.executor.executeStream({
        code,
        sessionId,
        timeout,
        packages,
        variables,
        allowNetworking,
        maxMemory,
        maxCpu
      }, (chunk) => {
        // Send streaming output as Server-Sent Events
        const event = {
          type: chunk.type,
          data: chunk.data,
          timestamp: new Date().toISOString()
        };
        \n        reply.raw.write(`data: ${JSON.stringify(event)}

`);
      });

      // Send completion event
      const completionEvent = {
        type: 'complete',
        data: result,
        timestamp: new Date().toISOString()
      };
      \n      reply.raw.write(`data: ${JSON.stringify(completionEvent)}

`);
      reply.raw.end();

    } catch (error) {
      server.log.error('Streaming execution error:', error);
      
      const errorEvent = {
        type: 'error',
        data: {
          error: error.name,
          message: error.message
        },
        timestamp: new Date().toISOString()
      };
      \n      reply.raw.write(`data: ${JSON.stringify(errorEvent)}

`);
      reply.raw.end();
    }
  });

  // Get execution status\n  server.get('/status/:executionId', {
    schema: {
      params: Type.Object({
        executionId: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          executionId: Type.String(),
          status: Type.Union([
            Type.Literal('pending'),
            Type.Literal('running'),
            Type.Literal('completed'),
            Type.Literal('failed')
          ]),
          progress: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
          result: Type.Optional(ExecuteResponseSchema)
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { executionId } = request.params;

    // TODO: Implement execution status tracking
    // This would require storing execution state in memory or Redis
    
    return reply.status(404).send({
      error: 'Not Found',\n      message: `Execution ${executionId} not found`
    });
  });

  // Cancel execution\n  server.delete('/:executionId', {
    schema: {
      params: Type.Object({
        executionId: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String()
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { executionId } = request.params;

    // TODO: Implement execution cancellation
    // This would require tracking active executions and their processes
    
    return reply.status(404).send({
      error: 'Not Found',\n      message: `Execution ${executionId} not found`
    });
  });
};

export default executeRoute;