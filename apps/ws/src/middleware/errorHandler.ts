import { logger } from '../utils/logger';
import { AuthenticatedSocket, SocketEvent, SocketError } from '../types';

interface ErrorHandlerConfig {
  logErrors?: boolean;
  includeStackTrace?: boolean;
  maxErrorsPerSocket?: number;
  errorWindowMs?: number;
  disconnectOnMaxErrors?: boolean;
  customErrorTypes?: Record<string, ErrorHandler>;
}

interface ErrorHandler {
  message: string;
  shouldDisconnect?: boolean;
  shouldLog?: boolean;
  customData?: any;
}

interface SocketErrorTracking {
  errors: Array<{ timestamp: number; error: string }>;
  totalCount: number;
  lastError?: Date;
}

const defaultConfig: ErrorHandlerConfig = {
  logErrors: true,
  includeStackTrace: false,
  maxErrorsPerSocket: 50,
  errorWindowMs: 60000, // 1 minute
  disconnectOnMaxErrors: true,
  customErrorTypes: {
    'RATE_LIMIT_EXCEEDED': {
      message: 'Too many requests, please slow down',
      shouldDisconnect: false,
      shouldLog: false
    },
    'AUTHENTICATION_FAILED': {
      message: 'Authentication failed',
      shouldDisconnect: true,
      shouldLog: true
    },
    'PERMISSION_DENIED': {
      message: 'Permission denied',
      shouldDisconnect: false,
      shouldLog: true
    },
    'INVALID_DATA': {
      message: 'Invalid data provided',
      shouldDisconnect: false,
      shouldLog: false
    },
    'TENANT_ISOLATION_VIOLATION': {
      message: 'Access denied to resource',
      shouldDisconnect: false,
      shouldLog: true
    },
    'INTERNAL_ERROR': {
      message: 'An internal error occurred',
      shouldDisconnect: false,
      shouldLog: true
    }
  }
};

export function errorHandlerMiddleware(config: ErrorHandlerConfig = defaultConfig) {
  const errorTracking: Map<string, SocketErrorTracking> = new Map();

  return (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    // Initialize error tracking for this socket
    errorTracking.set(socket.id, {
      errors: [],
      totalCount: 0
    });

    // Set up global error handler
    setupGlobalErrorHandler(socket, config, errorTracking);

    // Set up event error handlers
    setupEventErrorHandlers(socket, config, errorTracking);

    // Clean up on disconnect
    socket.on('disconnect', () => {
      errorTracking.delete(socket.id);
    });

    next();
  };
}

function setupGlobalErrorHandler(
  socket: AuthenticatedSocket, 
  config: ErrorHandlerConfig,
  errorTracking: Map<string, SocketErrorTracking>
) {
  // Handle socket errors
  socket.on('error', (error: any) => {
    handleSocketError(socket, error, 'SOCKET_ERROR', config, errorTracking);
  });

  // Handle connection errors
  socket.on('connect_error', (error: any) => {
    handleSocketError(socket, error, 'CONNECTION_ERROR', config, errorTracking);
  });

  // Handle disconnect errors
  socket.on('disconnect_error', (error: any) => {
    handleSocketError(socket, error, 'DISCONNECT_ERROR', config, errorTracking);
  });

  // Override emit to catch errors
  const originalEmit = socket.emit.bind(socket);
  socket.emit = function(event: string, ...args: any[]) {
    try {
      return originalEmit(event, ...args);
    } catch (error) {
      handleSocketError(socket, error, 'EMIT_ERROR', config, errorTracking);
      return false;
    }
  };
}

function setupEventErrorHandlers(
  socket: AuthenticatedSocket, 
  config: ErrorHandlerConfig,
  errorTracking: Map<string, SocketErrorTracking>
) {
  // Wrap all event handlers with error handling
  const originalOn = socket.on.bind(socket);
  
  socket.on = function(event: string, listener: Function) {
    const wrappedListener = (...args: any[]) => {
      try {
        const result = listener.apply(this, args);
        
        // Handle promises
        if (result && typeof result.catch === 'function') {
          result.catch((error: any) => {
            handleSocketError(
              socket, 
              error, 
              `ASYNC_ERROR_${event.toUpperCase()}`, 
              config, 
              errorTracking
            );
          });
        }
        
        return result;
      } catch (error) {
        handleSocketError(
          socket, 
          error, 
          `EVENT_ERROR_${event.toUpperCase()}`, 
          config, 
          errorTracking
        );
      }
    };

    return originalOn(event, wrappedListener);
  };
}

function handleSocketError(
  socket: AuthenticatedSocket,
  error: any,
  errorType: string,
  config: ErrorHandlerConfig,
  errorTracking: Map<string, SocketErrorTracking>
) {
  const socketTracking = errorTracking.get(socket.id);
  if (!socketTracking) return;

  const now = Date.now();
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // Update error tracking
  socketTracking.errors.push({ timestamp: now, error: errorMessage });
  socketTracking.totalCount++;
  socketTracking.lastError = new Date();

  // Clean old errors outside the window
  const windowStart = now - (config.errorWindowMs || 60000);
  socketTracking.errors = socketTracking.errors.filter(e => e.timestamp > windowStart);

  // Check if we should log this error
  const shouldLog = getShouldLog(errorType, config);
  const shouldDisconnect = getShouldDisconnect(errorType, config);
  const customHandler = config.customErrorTypes?.[errorType];

  if (shouldLog && config.logErrors) {
    const logData: any = {
      socketId: socket.id,
      userId: socket.user?.id,
      tenantId: socket.user?.tenantId,
      errorType,
      errorMessage,
      errorCount: socketTracking.errors.length,
      totalErrors: socketTracking.totalCount,
      clientIP: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    };

    if (config.includeStackTrace && error?.stack) {
      logData.stack = error.stack;
    }

    if (error?.code) {
      logData.errorCode = error.code;
    }

    logger.error(logData, `WebSocket error: ${errorType}`);
  }

  // Create standardized error response
  const socketError: SocketError = {
    code: errorType,
    message: customHandler?.message || getErrorMessage(errorType, errorMessage),
    timestamp: new Date(),
    details: {
      type: errorType,
      ...(customHandler?.customData || {})
    }
  };

  // Send error to client
  socket.emit(SocketEvent.ERROR, {
    ...socketError,
    timestamp: socketError.timestamp.toISOString()
  });

  // Check if we should disconnect due to too many errors
  const maxErrors = config.maxErrorsPerSocket || 50;
  const recentErrors = socketTracking.errors.length;
  
  if (config.disconnectOnMaxErrors && recentErrors >= maxErrors) {
    logger.warn({
      socketId: socket.id,
      userId: socket.user?.id,
      recentErrors,
      maxErrors,
      windowMs: config.errorWindowMs
    }, 'Disconnecting socket due to too many errors');

    socket.emit(SocketEvent.ERROR, {
      code: 'TOO_MANY_ERRORS',
      message: 'Too many errors occurred, disconnecting',
      timestamp: new Date().toISOString(),
      details: {
        errorCount: recentErrors,
        maxAllowed: maxErrors
      }
    });

    socket.disconnect(true);
    return;
  }

  // Disconnect if error type requires it
  if (shouldDisconnect) {
    logger.info({
      socketId: socket.id,
      userId: socket.user?.id,
      errorType
    }, 'Disconnecting socket due to error type');

    setTimeout(() => {
      socket.disconnect(true);
    }, 1000); // Small delay to allow error message to be sent
  }
}

function getShouldLog(errorType: string, config: ErrorHandlerConfig): boolean {
  const customHandler = config.customErrorTypes?.[errorType];
  if (customHandler && customHandler.shouldLog !== undefined) {
    return customHandler.shouldLog;
  }

  // Default logging behavior based on error type
  const noLogTypes = ['RATE_LIMIT_EXCEEDED', 'INVALID_DATA'];
  return !noLogTypes.includes(errorType);
}

function getShouldDisconnect(errorType: string, config: ErrorHandlerConfig): boolean {
  const customHandler = config.customErrorTypes?.[errorType];
  if (customHandler && customHandler.shouldDisconnect !== undefined) {
    return customHandler.shouldDisconnect;
  }

  // Default disconnect behavior based on error type
  const disconnectTypes = ['AUTHENTICATION_FAILED', 'AUTHORIZATION_FAILED', 'MALICIOUS_ACTIVITY'];
  return disconnectTypes.includes(errorType);
}

function getErrorMessage(errorType: string, originalMessage: string): string {
  const errorMessages: Record<string, string> = {
    'AUTHENTICATION_FAILED': 'Authentication failed',
    'AUTHORIZATION_FAILED': 'Access denied',
    'RATE_LIMIT_EXCEEDED': 'Rate limit exceeded',
    'INVALID_DATA': 'Invalid data provided',
    'TENANT_ISOLATION_VIOLATION': 'Access denied',
    'CONNECTION_ERROR': 'Connection error occurred',
    'SOCKET_ERROR': 'Socket error occurred',
    'EMIT_ERROR': 'Error sending message',
    'INTERNAL_ERROR': 'An internal error occurred'
  };

  return errorMessages[errorType] || 'An error occurred';
}

// Error helper functions
export function createSocketError(
  code: string, 
  message: string, 
  details?: any
): SocketError {
  return {
    code,
    message,
    timestamp: new Date(),
    details
  };
}

export function emitError(
  socket: AuthenticatedSocket, 
  error: string | Error | SocketError,
  context?: any
) {
  let socketError: SocketError;

  if (typeof error === 'string') {
    socketError = createSocketError('GENERIC_ERROR', error, context);
  } else if (error instanceof Error) {
    socketError = createSocketError(
      error.name || 'ERROR',
      error.message,
      { ...context, stack: error.stack }
    );
  } else {
    socketError = error;
  }

  socket.emit(SocketEvent.ERROR, {
    ...socketError,
    timestamp: socketError.timestamp.toISOString()
  });
}

export function handleAsyncError(
  socket: AuthenticatedSocket,
  promise: Promise<any>,
  errorType: string = 'ASYNC_ERROR'
) {
  promise.catch(error => {
    emitError(socket, createSocketError(errorType, error.message || error.toString()));
  });
}

// Validation helpers
export function validateAndEmitError(
  socket: AuthenticatedSocket,
  condition: boolean,
  errorType: string,
  message: string
): boolean {
  if (!condition) {
    emitError(socket, createSocketError(errorType, message));
    return false;
  }
  return true;
}

export function requireAuth(socket: AuthenticatedSocket): boolean {
  return validateAndEmitError(
    socket,
    !!socket.user,
    'AUTHENTICATION_FAILED',
    'Authentication required'
  );
}

export function requirePermission(socket: AuthenticatedSocket, permission: string): boolean {
  if (!requireAuth(socket)) return false;

  return validateAndEmitError(
    socket,
    socket.user!.permissions.includes(permission) || socket.user!.permissions.includes('admin'),
    'PERMISSION_DENIED',
    `Permission '${permission}' required`
  );
}

export function requireRole(socket: AuthenticatedSocket, role: string): boolean {
  if (!requireAuth(socket)) return false;

  return validateAndEmitError(
    socket,
    socket.user!.role === role || socket.user!.role === 'admin',
    'AUTHORIZATION_FAILED',
    `Role '${role}' required`
  );
}

// Custom error types
export class WebSocketError extends Error {
  public code: string;
  public socketId?: string;
  public userId?: string;
  public shouldDisconnect: boolean;

  constructor(
    code: string,
    message: string,
    shouldDisconnect: boolean = false,
    socketId?: string,
    userId?: string
  ) {
    super(message);
    this.name = 'WebSocketError';
    this.code = code;
    this.shouldDisconnect = shouldDisconnect;
    this.socketId = socketId;
    this.userId = userId;
  }
}

export class AuthenticationError extends WebSocketError {
  constructor(message: string = 'Authentication failed', socketId?: string) {
    super('AUTHENTICATION_FAILED', message, true, socketId);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends WebSocketError {
  constructor(message: string = 'Access denied', socketId?: string, userId?: string) {
    super('AUTHORIZATION_FAILED', message, false, socketId, userId);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends WebSocketError {
  public retryAfter: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter: number = 60000, socketId?: string) {
    super('RATE_LIMIT_EXCEEDED', message, false, socketId);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class ValidationError extends WebSocketError {
  public validationErrors: any;

  constructor(message: string = 'Validation failed', validationErrors?: any, socketId?: string) {
    super('VALIDATION_ERROR', message, false, socketId);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

// Error recovery utilities
export function withErrorRecovery<T>(
  socket: AuthenticatedSocket,
  operation: () => Promise<T>,
  fallback?: () => T | Promise<T>,
  errorType: string = 'OPERATION_ERROR'
): Promise<T | undefined> {
  return operation().catch(async (error) => {
    emitError(socket, createSocketError(errorType, error.message));
    
    if (fallback) {
      try {
        return await fallback();
      } catch (fallbackError) {
        emitError(socket, createSocketError(
          'FALLBACK_ERROR', 
          fallbackError.message || fallbackError.toString()
        ));
      }
    }
    
    return undefined;
  });
}

export function withRetry<T>(
  socket: AuthenticatedSocket,
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  errorType: string = 'RETRY_ERROR'
): Promise<T | undefined> {
  let attempts = 0;
  
  const attempt = async (): Promise<T | undefined> => {
    attempts++;
    
    try {
      return await operation();
    } catch (error) {
      if (attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempts));
        return attempt();
      } else {
        emitError(socket, createSocketError(
          errorType, 
          `Operation failed after ${maxRetries} attempts: ${error.message}`
        ));
        return undefined;
      }
    }
  };
  
  return attempt();
}