import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const SessionSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  createdAt: Type.String({ format: 'date-time' }),
  lastActivity: Type.String({ format: 'date-time' }),
  status: Type.Union([
    Type.Literal('active'),
    Type.Literal('idle'),
    Type.Literal('terminated')
  ]),
  variables: Type.Record(Type.String(), Type.Any()),
  installedPackages: Type.Array(Type.String()),
  resourceUsage: Type.Object({
    memory: Type.Number(),
    cpu: Type.Number(),
    executions: Type.Number()
  }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any()))
});

const CreateSessionRequestSchema = Type.Object({
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  packages: Type.Optional(Type.Array(Type.String())),
  variables: Type.Optional(Type.Record(Type.String(), Type.Any()))
});

const UpdateSessionRequestSchema = Type.Object({
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  variables: Type.Optional(Type.Record(Type.String(), Type.Any()))
});

const sessionsRoute: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // List all sessions
  server.get('/', {
    schema: {
      querystring: Type.Object({
        status: Type.Optional(Type.Union([
          Type.Literal('active'),
          Type.Literal('idle'),
          Type.Literal('terminated')
        ])),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
        sortBy: Type.Optional(Type.Union([
          Type.Literal('createdAt'),
          Type.Literal('lastActivity'),
          Type.Literal('executions')
        ])),
        sortOrder: Type.Optional(Type.Union([
          Type.Literal('asc'),
          Type.Literal('desc')
        ]))
      }),
      response: {
        200: Type.Object({
          sessions: Type.Array(SessionSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()
        })
      }
    }
  }, async (request, reply) => {
    const { 
      status, 
      limit = 20, 
      offset = 0, 
      sortBy = 'lastActivity', 
      sortOrder = 'desc' 
    } = request.query;

    try {
      const sessions = await getAllSessions();
      
      // Filter by status
      let filteredSessions = status 
        ? sessions.filter(session => getSessionStatus(session) === status)
        : sessions;

      // Sort sessions
      filteredSessions.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'createdAt':
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
          case 'lastActivity':
            aValue = new Date(a.lastActivity).getTime();
            bValue = new Date(b.lastActivity).getTime();
            break;
          case 'executions':
            aValue = a.resourceUsage.executions;
            bValue = b.resourceUsage.executions;
            break;
          default:
            return 0;
        }

        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      });

      // Apply pagination
      const paginatedSessions = filteredSessions.slice(offset, offset + limit);

      return {
        sessions: paginatedSessions,
        total: filteredSessions.length,
        limit,
        offset
      };

    } catch (error) {
      server.log.error('Error listing sessions:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list sessions'
      });
    }
  });

  // Create a new session
  server.post('/', {
    schema: {
      body: CreateSessionRequestSchema,
      response: {
        201: SessionSchema,
        400: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { metadata, packages, variables } = request.body;

    try {
      // Create session through executor
      const sessionId = await server.executor.createSession();
      
      // Get the created session
      const session = await server.executor.getSession(sessionId);
      if (!session) {
        throw new Error('Failed to create session');
      }

      // Initialize with provided data
      if (variables) {
        session.variables = { ...session.variables, ...variables };
      }

      if (packages) {
        // TODO: Install initial packages
        session.installedPackages = packages;
      }

      const sessionResponse = await formatSessionForResponse(session, metadata);

      reply.status(201);
      return sessionResponse;

    } catch (error) {
      server.log.error('Error creating session:', error);
      
      return reply.status(400).send({
        error: 'Session Creation Error',
        message: error.message
      });
    }
  });

  // Get a specific session
  server.get('/:sessionId', {
    schema: {
      params: Type.Object({
        sessionId: Type.String({ format: 'uuid' })
      }),
      response: {
        200: SessionSchema,
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params;

    try {
      const session = await server.executor.getSession(sessionId);
      
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      const sessionResponse = await formatSessionForResponse(session);
      return sessionResponse;

    } catch (error) {
      server.log.error('Error getting session:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get session'
      });
    }
  });

  // Update a session
  server.patch('/:sessionId', {
    schema: {
      params: Type.Object({
        sessionId: Type.String({ format: 'uuid' })
      }),
      body: UpdateSessionRequestSchema,
      response: {
        200: SessionSchema,
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const { metadata, variables } = request.body;

    try {
      const session = await server.executor.getSession(sessionId);
      
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      // Update session data
      if (variables) {
        session.variables = { ...session.variables, ...variables };
      }

      session.lastActivity = new Date();

      const sessionResponse = await formatSessionForResponse(session, metadata);
      return sessionResponse;

    } catch (error) {
      server.log.error('Error updating session:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update session'
      });
    }
  });

  // Delete a session
  server.delete('/:sessionId', {
    schema: {
      params: Type.Object({
        sessionId: Type.String({ format: 'uuid' })
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
    const { sessionId } = request.params;

    try {
      const session = await server.executor.getSession(sessionId);
      
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      await server.executor.destroySession(sessionId);

      return {
        success: true,
        message: `Session '${sessionId}' deleted successfully`
      };

    } catch (error) {
      server.log.error('Error deleting session:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete session'
      });
    }
  });

  // Get session variables
  server.get('/:sessionId/variables', {
    schema: {
      params: Type.Object({
        sessionId: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          sessionId: Type.String(),
          variables: Type.Record(Type.String(), Type.Any()),
          lastUpdated: Type.String({ format: 'date-time' })
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params;

    try {
      const session = await server.executor.getSession(sessionId);
      
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      return {
        sessionId,
        variables: session.variables,
        lastUpdated: session.lastActivity.toISOString()
      };

    } catch (error) {
      server.log.error('Error getting session variables:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get session variables'
      });
    }
  });

  // Update session variables
  server.put('/:sessionId/variables', {
    schema: {
      params: Type.Object({
        sessionId: Type.String({ format: 'uuid' })
      }),
      body: Type.Record(Type.String(), Type.Any()),
      response: {
        200: Type.Object({
          sessionId: Type.String(),
          variables: Type.Record(Type.String(), Type.Any()),
          updated: Type.Array(Type.String())
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const variables = request.body;

    try {
      const session = await server.executor.getSession(sessionId);
      
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      const updated = Object.keys(variables);
      session.variables = { ...session.variables, ...variables };
      session.lastActivity = new Date();

      return {
        sessionId,
        variables: session.variables,
        updated
      };

    } catch (error) {
      server.log.error('Error updating session variables:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update session variables'
      });
    }
  });

  // Clear session variables
  server.delete('/:sessionId/variables', {
    schema: {
      params: Type.Object({
        sessionId: Type.String({ format: 'uuid' })
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
    const { sessionId } = request.params;

    try {
      const session = await server.executor.getSession(sessionId);
      
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      session.variables = {};
      session.lastActivity = new Date();

      return {
        success: true,
        message: 'Session variables cleared'
      };

    } catch (error) {
      server.log.error('Error clearing session variables:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to clear session variables'
      });
    }
  });

  // Get session statistics
  server.get('/:sessionId/stats', {
    schema: {
      params: Type.Object({
        sessionId: Type.String({ format: 'uuid' })
      }),
      response: {
        200: Type.Object({
          sessionId: Type.String(),
          resourceUsage: Type.Object({
            memory: Type.Number(),
            cpu: Type.Number(),
            executions: Type.Number(),
            totalExecutionTime: Type.Number()
          }),
          status: Type.Union([
            Type.Literal('active'),
            Type.Literal('idle'),
            Type.Literal('terminated')
          ]),
          uptime: Type.Number(),
          lastActivity: Type.String({ format: 'date-time' })
        }),
        404: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { sessionId } = request.params;

    try {
      const session = await server.executor.getSession(sessionId);
      
      if (!session) {
        return reply.status(404).send({
          error: 'Session Not Found',
          message: `Session '${sessionId}' not found`
        });
      }

      const resourceUsage = await getSessionResourceUsage(session);
      const uptime = Date.now() - session.createdAt.getTime();
      const status = getSessionStatus(session);

      return {
        sessionId,
        resourceUsage,
        status,
        uptime,
        lastActivity: session.lastActivity.toISOString()
      };

    } catch (error) {
      server.log.error('Error getting session stats:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get session statistics'
      });
    }
  });
};

// Helper functions
async function getAllSessions(): Promise<any[]> {
  // This would typically come from the executor or a session store
  // For now, return empty array as placeholder
  return [];
}

function getSessionStatus(session: any): 'active' | 'idle' | 'terminated' {
  const now = Date.now();
  const lastActivity = session.lastActivity.getTime();
  const timeSinceActivity = now - lastActivity;

  // Consider session idle after 5 minutes of inactivity
  if (timeSinceActivity > 5 * 60 * 1000) {
    return 'idle';
  }

  return 'active';
}

async function getSessionResourceUsage(session: any): Promise<{
  memory: number;
  cpu: number;
  executions: number;
  totalExecutionTime: number;
}> {
  // This would query actual resource usage from the container
  // For now, return placeholder values
  return {
    memory: 0,
    cpu: 0,
    executions: 0,
    totalExecutionTime: 0
  };
}

async function formatSessionForResponse(session: any, metadata?: Record<string, any>): Promise<{
  id: string;
  createdAt: string;
  lastActivity: string;
  status: 'active' | 'idle' | 'terminated';
  variables: Record<string, any>;
  installedPackages: string[];
  resourceUsage: {
    memory: number;
    cpu: number;
    executions: number;
  };
  metadata?: Record<string, any>;
}> {
  const status = getSessionStatus(session);
  const resourceUsage = await getSessionResourceUsage(session);

  return {
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    lastActivity: session.lastActivity.toISOString(),
    status,
    variables: session.variables,
    installedPackages: session.installedPackages,
    resourceUsage,
    ...(metadata && { metadata })
  };
}

export default sessionsRoute;