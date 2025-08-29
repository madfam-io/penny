import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { AuthenticatedSocket, User, SocketEvent } from '../types';

interface JWTConfig {
  secret: string;
  audience?: string;
  issuer?: string;
}

interface JWTPayload {
  sub: string; // User ID
  tenantId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

export function authenticationMiddleware(jwtConfig: JWTConfig) {
  return async (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    try {
      // Extract token from various sources
      let token: string | undefined;

      // 1. Check auth query parameter
      if (socket.handshake.query.token && typeof socket.handshake.query.token === 'string') {
        token = socket.handshake.query.token;
      }
      
      // 2. Check Authorization header
      if (!token && socket.handshake.headers.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      // 3. Check auth in handshake data
      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }

      if (!token) {
        logger.warn({
          socketId: socket.id,
          clientIP: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent']
        }, 'WebSocket connection attempt without token');

        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = await verifyToken(token, jwtConfig);
      
      if (!decoded) {
        logger.warn({
          socketId: socket.id,
          clientIP: socket.handshake.address
        }, 'WebSocket connection attempt with invalid token');

        return next(new Error('Invalid authentication token'));
      }

      // Create user object from JWT payload
      const user: User = {
        id: decoded.sub,
        tenantId: decoded.tenantId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        permissions: decoded.permissions || []
      };

      // Validate required fields
      if (!user.id || !user.tenantId || !user.email) {
        logger.warn({
          socketId: socket.id,
          decodedPayload: decoded
        }, 'WebSocket token missing required fields');

        return next(new Error('Invalid token payload'));
      }

      // Attach user to socket
      socket.user = user;
      socket.isAuthenticated = true;

      // Add connection timestamp
      (socket as any).authenticatedAt = new Date();
      (socket as any).connectedAt = Date.now();

      logger.info({
        socketId: socket.id,
        userId: user.id,
        tenantId: user.tenantId,
        userEmail: user.email,
        userRole: user.role,
        clientIP: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      }, 'WebSocket authenticated successfully');

      next();

    } catch (error) {
      logger.error({
        socketId: socket.id,
        error: error.message,
        clientIP: socket.handshake.address
      }, 'WebSocket authentication error');

      return next(new Error('Authentication failed'));
    }
  };
}

async function verifyToken(token: string, config: JWTConfig): Promise<JWTPayload | null> {
  try {
    const options: jwt.VerifyOptions = {};
    
    if (config.audience) {
      options.audience = config.audience;
    }
    
    if (config.issuer) {
      options.issuer = config.issuer;
    }

    const decoded = jwt.verify(token, config.secret, options) as JWTPayload;

    // Additional validation
    if (!decoded.sub || !decoded.tenantId) {
      return null;
    }

    return decoded;

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.debug('JWT token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.debug({ error: error.message }, 'JWT token invalid');
    } else {
      logger.error({ error: error.message }, 'JWT verification error');
    }
    
    return null;
  }
}

// Additional authentication helpers
export function requirePermission(permission: string) {
  return (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    if (!socket.user) {
      return next(new Error('User not authenticated'));
    }

    if (!socket.user.permissions.includes(permission) && !socket.user.permissions.includes('admin')) {
      logger.warn({
        userId: socket.user.id,
        requiredPermission: permission,
        userPermissions: socket.user.permissions
      }, 'WebSocket permission denied');

      return next(new Error(`Permission denied: ${permission} required`));
    }

    next();
  };
}

export function requireRole(role: string) {
  return (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    if (!socket.user) {
      return next(new Error('User not authenticated'));
    }

    if (socket.user.role !== role && socket.user.role !== 'admin') {
      logger.warn({
        userId: socket.user.id,
        requiredRole: role,
        userRole: socket.user.role
      }, 'WebSocket role check failed');

      return next(new Error(`Role denied: ${role} required`));
    }

    next();
  };
}

export function requireTenant(tenantId: string) {
  return (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    if (!socket.user) {
      return next(new Error('User not authenticated'));
    }

    if (socket.user.tenantId !== tenantId) {
      logger.warn({
        userId: socket.user.id,
        userTenantId: socket.user.tenantId,
        requiredTenantId: tenantId
      }, 'WebSocket tenant access denied');

      return next(new Error('Access denied: Wrong tenant'));
    }

    next();
  };
}

// Middleware to validate conversation access
export function validateConversationAccess() {
  return async (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    // This would be used in conversation-specific namespaces
    // Implementation depends on your conversation access control logic
    next();
  };
}

// Middleware to refresh token if it's about to expire
export function tokenRefreshMiddleware(refreshThresholdMinutes: number = 30) {
  return (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    if (!socket.user) {
      return next();
    }

    const tokenPayload = (socket as any).tokenPayload;
    if (tokenPayload && tokenPayload.exp) {
      const expiresAt = tokenPayload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const refreshThreshold = refreshThresholdMinutes * 60 * 1000; // Convert to milliseconds

      if (expiresAt - now < refreshThreshold) {
        // Token is about to expire, emit refresh event
        socket.emit('token_refresh_required', {
          expiresAt: new Date(expiresAt).toISOString(),
          timeUntilExpiry: expiresAt - now,
          timestamp: new Date().toISOString()
        });

        logger.debug({
          userId: socket.user.id,
          expiresAt: new Date(expiresAt).toISOString()
        }, 'Token refresh required');
      }
    }

    next();
  };
}

// Event handler for token refresh
export function handleTokenRefresh(socket: AuthenticatedSocket, newToken: string, jwtConfig: JWTConfig) {
  return async () => {
    try {
      const decoded = await verifyToken(newToken, jwtConfig);
      
      if (!decoded) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Invalid refresh token',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Update user info if needed
      const newUser: User = {
        id: decoded.sub,
        tenantId: decoded.tenantId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        permissions: decoded.permissions || []
      };

      // Verify user identity hasn't changed
      if (socket.user && socket.user.id !== newUser.id) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Invalid token refresh: User identity changed',
          timestamp: new Date().toISOString()
        });
        socket.disconnect();
        return;
      }

      // Update socket user info
      socket.user = newUser;
      (socket as any).tokenPayload = decoded;

      socket.emit('token_refreshed', {
        timestamp: new Date().toISOString()
      });

      logger.info({
        userId: newUser.id,
        socketId: socket.id
      }, 'Token refreshed successfully');

    } catch (error) {
      logger.error({
        socketId: socket.id,
        error: error.message
      }, 'Token refresh failed');

      socket.emit(SocketEvent.ERROR, {
        message: 'Token refresh failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

// Utility function to extract user info from socket
export function getUserFromSocket(socket: Socket): User | null {
  const authSocket = socket as AuthenticatedSocket;
  return authSocket.user || null;
}

// Utility function to check if socket is authenticated
export function isSocketAuthenticated(socket: Socket): socket is AuthenticatedSocket {
  const authSocket = socket as AuthenticatedSocket;
  return authSocket.isAuthenticated === true && authSocket.user != null;
}