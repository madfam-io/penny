import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditConfig {
  enabled: boolean;
  logSuccessfulRequests: boolean;
  logFailedRequests: boolean;
  excludePaths: string[];
  excludeActions: string[];
  sensitiveFields: string[];
  maxMetadataSize: number;
}

export async function auditLoggingPlugin(fastify: FastifyInstance) {
  const prisma = new PrismaClient();
  
  const defaultConfig: AuditConfig = {
    enabled: process.env.AUDIT_LOGGING_ENABLED !== 'false',
    logSuccessfulRequests: true,
    logFailedRequests: true,
    excludePaths: [\n      '/health',\n      '/metrics',\n      '/ping',\n      '/api-keys',\n      '/rate-limit',
    ],
    excludeActions: [
      'READ', // Don't log read operations by default
      'HEALTH_CHECK',
      'METRICS',
    ],
    sensitiveFields: [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'cookie',
    ],
    maxMetadataSize: 10000, // 10KB max for metadata
  };

  // Store original request body and response for logging
  fastify.decorateRequest('auditMetadata', {});

  fastify.decorate('auditLog', function(config: Partial<AuditConfig> = {}) {
    const auditConfig = { ...defaultConfig, ...config };
    
    return async function(request: FastifyRequest, reply: FastifyReply) {
      if (!auditConfig.enabled) {
        return;
      }

      // Skip excluded paths
      if (auditConfig.excludePaths.some(path => request.url.includes(path))) {
        return;
      }

      // Store start time for performance tracking
      request.auditMetadata = {
        startTime: process.hrtime.bigint(),
        config: auditConfig,
      };
    };
  });

  // Hook to capture request data
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.auditMetadata?.config?.enabled) {
      return;
    }

    const config = request.auditMetadata.config as AuditConfig;

    // Capture request data
    request.auditMetadata.requestData = {
      method: request.method,
      url: request.url,
      headers: sanitizeHeaders(request.headers, config.sensitiveFields),
      query: request.query,
      body: request.method !== 'GET' ? sanitizeObject(request.body, config.sensitiveFields) : undefined,
      userAgent: request.headers['user-agent'],
      ipAddress: getClientIP(request),
    };
  });

  // Hook to capture response data and log audit entry
  fastify.addHook('onResponse', async (request, reply) => {
    if (!request.auditMetadata?.config?.enabled) {
      return;
    }

    const config = request.auditMetadata.config as AuditConfig;
    const isSuccessful = reply.statusCode < 400;
    const isFailed = reply.statusCode >= 400;

    // Skip if configured not to log this type of request
    if ((isSuccessful && !config.logSuccessfulRequests) || 
        (isFailed && !config.logFailedRequests)) {
      return;
    }

    try {
      const action = determineAction(request);
      
      // Skip excluded actions
      if (config.excludeActions.includes(action)) {
        return;
      }

      const resource = determineResource(request);
      const resourceId = extractResourceId(request);

      // Calculate response time
      const endTime = process.hrtime.bigint();
      const responseTimeMs = Number(endTime - request.auditMetadata.startTime) / 1000000;

      const auditEntry: AuditLogEntry = {
        tenantId: request.user?.tenantId || 'system',
        userId: request.user?.id || request.apiKey?.userId,
        action,
        resource,
        resourceId,
        metadata: {
          ...request.auditMetadata.requestData,
          response: {
            statusCode: reply.statusCode,
            responseTimeMs: Math.round(responseTimeMs),
          },
          context: {
            apiKey: request.apiKey ? {
              id: request.apiKey.id,
              name: request.apiKey.name,
              scopes: request.apiKey.scopes,
            } : undefined,
            rateLimitInfo: request.rateLimitInfo,
          },
        },
        ipAddress: request.auditMetadata.requestData.ipAddress,
        userAgent: request.auditMetadata.requestData.userAgent,
      };

      // Truncate metadata if too large
      if (JSON.stringify(auditEntry.metadata).length > config.maxMetadataSize) {
        auditEntry.metadata = truncateMetadata(auditEntry.metadata, config.maxMetadataSize);
      }

      // Log to database (async, don't block response)
      logAuditEntry(auditEntry).catch(error => {
        fastify.log.error(error, 'Failed to log audit entry');
      });

      // Log to application logs for critical actions
      if (isCriticalAction(action) || isFailed) {
        fastify.log.info({
          audit: auditEntry,
        }, `Audit: ${action} ${resource} - ${reply.statusCode}`);
      }

    } catch (error) {
      fastify.log.error(error, 'Audit logging failed');
    }
  });

  // Manual audit logging for custom events
  fastify.decorate('logAudit', async function(
    action: string,
    resource: string,
    options: {
      resourceId?: string;
      metadata?: Record<string, unknown>;
      tenantId?: string;
      userId?: string;
      request?: FastifyRequest;
    } = {}
  ) {
    const { resourceId, metadata = {}, tenantId, userId, request } = options;

    const auditEntry: AuditLogEntry = {
      tenantId: tenantId || request?.user?.tenantId || 'system',
      userId: userId || request?.user?.id,
      action,
      resource,
      resourceId,
      metadata,
      ipAddress: request ? getClientIP(request) : undefined,
      userAgent: request?.headers['user-agent'],
    };

    try {
      await logAuditEntry(auditEntry);
    } catch (error) {
      fastify.log.error(error, 'Manual audit logging failed');
    }
  });

  // Audit query endpoint for admins
  fastify.get('/audit-logs', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string' },
          userId: { type: 'string' },
          action: { type: 'string' },
          resource: { type: 'string' },
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
          limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
          offset: { type: 'number', minimum: 0, default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  tenantId: { type: 'string' },
                  userId: { type: 'string' },
                  action: { type: 'string' },
                  resource: { type: 'string' },
                  resourceId: { type: 'string' },
                  metadata: { type: 'object' },
                  ipAddress: { type: 'string' },
                  userAgent: { type: 'string' },
                  timestamp: { type: 'string' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                limit: { type: 'number' },
                offset: { type: 'number' },
                hasMore: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    preHandler: [fastify.authenticate, fastify.requireAdmin],
  }, async (request) => {
    const query = request.query as any;
    
    const where: any = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.resource) where.resource = query.resource;
    if (query.from || query.to) {
      where.timestamp = {};
      if (query.from) where.timestamp.gte = new Date(query.from);
      if (query.to) where.timestamp.lte = new Date(query.to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map(log => ({
        id: log.id,
        tenantId: log.tenantId,
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        timestamp: log.timestamp.toISOString(),
      })),
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total,
      },
    };
  });

  // Helper functions
  async function logAuditEntry(entry: AuditLogEntry) {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId || null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId || null,
        metadata: entry.metadata || {},
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      },
    });
  }

  function determineAction(request: FastifyRequest): string {
    const method = request.method.toUpperCase();
    const url = request.url.toLowerCase();

    // Special cases\n    if (url.includes('/login')) return 'LOGIN';
    if (url.includes('/logout')) return 'LOGOUT';
    if (url.includes('/register')) return 'REGISTER';
    if (url.includes('/invite')) return 'INVITE_USER';
    if (url.includes('/archive')) return 'ARCHIVE';
    if (url.includes('/restore')) return 'RESTORE';
    if (url.includes('/export')) return 'EXPORT_DATA';
    if (url.includes('/import')) return 'IMPORT_DATA';
    if (url.includes('/test')) return 'TEST';
    if (url.includes('/reset')) return 'RESET';

    // HTTP method mapping
    switch (method) {
      case 'GET': return 'READ';
      case 'POST': return url.includes('search') ? 'SEARCH' : 'CREATE';
      case 'PUT': return 'UPDATE';
      case 'PATCH': return 'PARTIAL_UPDATE';
      case 'DELETE': return 'DELETE';
      default: return method;
    }
  }

  function determineResource(request: FastifyRequest): string {
    const url = request.url.toLowerCase();
    const pathSegments = url.split('/').filter(Boolean);

    // Remove query string
    if (pathSegments.length > 0) {
      pathSegments[pathSegments.length - 1] = pathSegments[pathSegments.length - 1].split('?')[0];
    }

    // Map URL patterns to resource types\n    if (url.includes('/conversations')) return 'conversation';
    if (url.includes('/messages')) return 'message';
    if (url.includes('/artifacts')) return 'artifact';
    if (url.includes('/tools')) return 'tool';
    if (url.includes('/users')) return 'user';
    if (url.includes('/tenants')) return 'tenant';
    if (url.includes('/webhooks')) return 'webhook';
    if (url.includes('/subscriptions') || url.includes('/billing')) return 'subscription';
    if (url.includes('/api-keys')) return 'api_key';
    if (url.includes('/usage')) return 'usage';
    if (url.includes('/admin')) return 'admin';
    if (url.includes('/auth')) return 'auth';

    // Default to first path segment or unknown
    return pathSegments[0] || 'unknown';
  }

  function extractResourceId(request: FastifyRequest): string | undefined {
    // Extract ID from URL params or body
    const params = request.params as any;
    const body = request.body as any;

    return params?.id || params?.resourceId || body?.id || body?.resourceId;
  }

  function getClientIP(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }
    return request.ip;
  }

  function sanitizeHeaders(headers: any, sensitiveFields: string[]): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  function sanitizeObject(obj: any, sensitiveFields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item, sensitiveFields));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value, sensitiveFields);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  function truncateMetadata(metadata: any, maxSize: number): any {
    const str = JSON.stringify(metadata);
    if (str.length <= maxSize) {
      return metadata;
    }

    // Try to preserve important fields
    const truncated: any = {
      _truncated: true,
      _originalSize: str.length,
      method: metadata.method,
      url: metadata.url,
      statusCode: metadata.response?.statusCode,
      responseTimeMs: metadata.response?.responseTimeMs,
    };

    // Add remaining fields until we hit the limit
    const remaining = maxSize - JSON.stringify(truncated).length - 100; // Buffer
    if (remaining > 0) {
      const remainingStr = str.substring(0, remaining) + '...';
      try {
        const partial = JSON.parse(remainingStr);
        Object.assign(truncated, partial);
      } catch {
        // If we can't parse truncated JSON, keep what we have
      }
    }

    return truncated;
  }

  function isCriticalAction(action: string): boolean {
    const criticalActions = [
      'DELETE',
      'CREATE',
      'UPDATE',
      'LOGIN',
      'LOGOUT',
      'REGISTER',
      'INVITE_USER',
      'EXPORT_DATA',
      'IMPORT_DATA',
      'RESET',
    ];

    return criticalActions.includes(action.toUpperCase());
  }

  // Cleanup old audit logs (run periodically)
  fastify.decorate('cleanupAuditLogs', async function(retentionDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const result = await prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });
\n      fastify.log.info(`Cleaned up ${result.count} old audit log entries`);
      return result.count;
    } catch (error) {
      fastify.log.error(error, 'Failed to cleanup old audit logs');
      throw error;
    }
  });

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    auditMetadata?: {
      startTime?: bigint;
      config?: AuditConfig;
      requestData?: any;
    };
  }

  interface FastifyInstance {
    auditLog: (config?: Partial<AuditConfig>) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    logAudit: (
      action: string,
      resource: string,
      options?: {
        resourceId?: string;
        metadata?: Record<string, unknown>;
        tenantId?: string;
        userId?: string;
        request?: FastifyRequest;
      }
    ) => Promise<void>;
    cleanupAuditLogs: (retentionDays?: number) => Promise<number>;
  }
}