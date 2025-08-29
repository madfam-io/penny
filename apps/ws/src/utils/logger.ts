import pino from 'pino';

// Create logger configuration
const createLoggerConfig = () => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

  const baseConfig = {
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label }),
      log: (object: any) => {
        // Remove sensitive data from logs
        const sanitized = { ...object };
        
        // Remove or mask sensitive fields
        if (sanitized.password) delete sanitized.password;
        if (sanitized.token && typeof sanitized.token === 'string') {
          sanitized.token = sanitized.token.substring(0, 10) + '...';
        }
        if (sanitized.authorization && typeof sanitized.authorization === 'string') {
          sanitized.authorization = sanitized.authorization.substring(0, 10) + '...';
        }
        if (sanitized.secret) delete sanitized.secret;
        if (sanitized.apiKey && typeof sanitized.apiKey === 'string') {
          sanitized.apiKey = sanitized.apiKey.substring(0, 6) + '...';
        }

        return sanitized;
      }
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: (req: any) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        headers: {
          ...req.headers,
          authorization: req.headers.authorization ? 'Bearer ***' : undefined
        },
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
        headers: res.headers
      })
    }
  };

  if (isDevelopment) {
    // Pretty print in development
    return {
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: '[{context}] {msg}',
          levelFirst: false,
          crlf: false,
          errorLikeObjectKeys: ['err', 'error']
        }
      }
    };
  }

  return baseConfig;
};

// Create the logger instance
export const logger = pino(createLoggerConfig());

// Create child loggers for different contexts
export const createContextLogger = (context: string, additionalFields?: Record<string, any>) => {
  return logger.child({ 
    context,
    ...additionalFields 
  });
};

// WebSocket specific logger
export const wsLogger = createContextLogger('websocket');

// Handler specific loggers
export const connectionLogger = createContextLogger('connection');
export const chatLogger = createContextLogger('chat');
export const presenceLogger = createContextLogger('presence');
export const collaborationLogger = createContextLogger('collaboration');
export const notificationLogger = createContextLogger('notification');
export const typingLogger = createContextLogger('typing');
export const reactionLogger = createContextLogger('reaction');

// Service specific loggers
export const roomServiceLogger = createContextLogger('room-service');
export const messageServiceLogger = createContextLogger('message-service');
export const presenceServiceLogger = createContextLogger('presence-service');
export const notificationServiceLogger = createContextLogger('notification-service');

// Middleware specific loggers
export const authLogger = createContextLogger('auth');
export const rateLimitLogger = createContextLogger('rate-limit');
export const tenantLogger = createContextLogger('tenant');
export const errorLogger = createContextLogger('error');

// Utility functions for structured logging
export const logSocketEvent = (
  socketId: string, 
  eventName: string, 
  userId?: string, 
  additionalData?: Record<string, any>
) => {
  wsLogger.debug({
    socketId,
    eventName,
    userId,
    ...additionalData
  }, `Socket event: ${eventName}`);
};

export const logUserAction = (
  userId: string,
  action: string,
  resource?: string,
  additionalData?: Record<string, any>
) => {
  logger.info({
    userId,
    action,
    resource,
    ...additionalData
  }, `User action: ${action}`);
};

export const logSecurityEvent = (
  eventType: 'auth_failure' | 'permission_denied' | 'rate_limit' | 'suspicious_activity',
  details: Record<string, any>
) => {
  logger.warn({
    securityEvent: eventType,
    ...details
  }, `Security event: ${eventType}`);
};

export const logPerformanceMetric = (
  metric: string,
  value: number,
  unit: string,
  additionalData?: Record<string, any>
) => {
  logger.info({
    metric,
    value,
    unit,
    ...additionalData
  }, `Performance metric: ${metric} = ${value}${unit}`);
};

export const logError = (
  error: Error,
  context: string,
  additionalData?: Record<string, any>
) => {
  logger.error({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context,
    ...additionalData
  }, `Error in ${context}: ${error.message}`);
};

export const logDatabaseOperation = (
  operation: string,
  table: string,
  duration?: number,
  recordCount?: number
) => {
  logger.debug({
    operation,
    table,
    duration,
    recordCount
  }, `Database operation: ${operation} on ${table}`);
};

export const logExternalApiCall = (
  service: string,
  endpoint: string,
  method: string,
  statusCode?: number,
  duration?: number
) => {
  logger.debug({
    externalService: service,
    endpoint,
    method,
    statusCode,
    duration
  }, `External API call: ${method} ${service}${endpoint}`);
};

// Request ID utilities for tracing
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

export const withRequestId = (requestId: string, additionalFields?: Record<string, any>) => {
  return logger.child({ 
    requestId,
    ...additionalFields 
  });
};

// Health check logging
export const logHealthCheck = (
  service: string,
  status: 'healthy' | 'degraded' | 'unhealthy',
  checks: Record<string, any>
) => {
  const logLevel = status === 'healthy' ? 'debug' : status === 'degraded' ? 'warn' : 'error';
  
  logger[logLevel]({
    healthCheck: service,
    status,
    checks
  }, `Health check: ${service} is ${status}`);
};

// Business metrics logging
export const logBusinessMetric = (
  metric: string,
  value: number,
  tags?: Record<string, string>
) => {
  logger.info({
    businessMetric: metric,
    value,
    tags
  }, `Business metric: ${metric} = ${value}`);
};

// Rate limiting logging
export const logRateLimit = (
  userId: string,
  action: string,
  limit: number,
  current: number,
  blocked: boolean
) => {
  const logLevel = blocked ? 'warn' : 'debug';
  
  logger[logLevel]({
    userId,
    action,
    rateLimit: {
      limit,
      current,
      blocked
    }
  }, `Rate limit ${blocked ? 'exceeded' : 'check'}: ${action} for user ${userId}`);
};

// WebSocket connection lifecycle logging
export const logConnectionLifecycle = (
  socketId: string,
  event: 'connect' | 'authenticate' | 'disconnect',
  userId?: string,
  duration?: number,
  reason?: string
) => {
  connectionLogger.info({
    socketId,
    event,
    userId,
    duration,
    reason
  }, `Connection ${event}${userId ? ` for user ${userId}` : ''}${duration ? ` (${duration}ms)` : ''}`);
};

// Message processing logging
export const logMessageProcessing = (
  messageId: string,
  conversationId: string,
  userId: string,
  processingTimeMs: number,
  hasToolCalls: boolean,
  hasAttachments: boolean
) => {
  chatLogger.info({
    messageId,
    conversationId,
    userId,
    processingTimeMs,
    hasToolCalls,
    hasAttachments
  }, `Message processed in ${processingTimeMs}ms`);
};

// Presence change logging
export const logPresenceChange = (
  userId: string,
  fromStatus: string,
  toStatus: string,
  reason?: string
) => {
  presenceLogger.info({
    userId,
    presenceChange: {
      from: fromStatus,
      to: toStatus,
      reason
    }
  }, `Presence changed: ${fromStatus} → ${toStatus}${reason ? ` (${reason})` : ''}`);
};

// Collaboration session logging
export const logCollaborationSession = (
  sessionId: string,
  event: 'start' | 'join' | 'leave' | 'end',
  userId: string,
  participantCount?: number
) => {
  collaborationLogger.info({
    sessionId,
    event,
    userId,
    participantCount
  }, `Collaboration session ${event}${participantCount ? ` (${participantCount} participants)` : ''}`);
};

// Export default logger
export default logger;