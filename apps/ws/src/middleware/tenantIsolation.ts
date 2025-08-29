import { logger } from '../utils/logger';
import { AuthenticatedSocket, SocketEvent, RoomType } from '../types';

interface TenantIsolationConfig {
  strictMode?: boolean; // If true, blocks cross-tenant operations completely
  allowedCrosstenantRoles?: string[]; // Roles that can access other tenants (e.g., 'admin', 'support')
  auditCrosstenantAccess?: boolean; // Log cross-tenant access attempts
}

const defaultConfig: TenantIsolationConfig = {
  strictMode: true,
  allowedCrosstenantRoles: ['admin', 'super_admin'],
  auditCrosstenantAccess: true
};

export function tenantIsolationMiddleware(config: TenantIsolationConfig = defaultConfig) {
  return (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    if (!socket.user) {
      // Authentication should handle this, but double-check
      return next(new Error('User not authenticated'));
    }

    // Set up tenant isolation event handlers
    setupTenantIsolationHandlers(socket, config);

    logger.debug({
      socketId: socket.id,
      userId: socket.user.id,
      tenantId: socket.user.tenantId,
      userRole: socket.user.role
    }, 'Tenant isolation middleware applied');

    next();
  };
}

function setupTenantIsolationHandlers(socket: AuthenticatedSocket, config: TenantIsolationConfig) {
  const originalEmit = socket.emit.bind(socket);
  const originalJoin = socket.join.bind(socket);
  const originalLeave = socket.leave.bind(socket);

  // Override socket.join to enforce tenant isolation
  socket.join = function(rooms: string | string[]): Promise<void> {
    const roomArray = Array.isArray(rooms) ? rooms : [rooms];
    const allowedRooms: string[] = [];
    const user = socket.user!;

    for (const room of roomArray) {
      if (validateRoomAccess(user, room, config)) {
        allowedRooms.push(room);
      } else {
        logger.warn({
          userId: user.id,
          userTenantId: user.tenantId,
          userRole: user.role,
          attemptedRoom: room,
          socketId: socket.id
        }, 'Tenant isolation: Blocked room join attempt');

        // Emit error to client
        socket.emit(SocketEvent.ERROR, {
          message: 'Access denied to room',
          room,
          reason: 'tenant_isolation',
          timestamp: new Date().toISOString()
        });
      }
    }

    if (allowedRooms.length > 0) {
      return originalJoin(allowedRooms);
    }

    return Promise.resolve();
  };

  // Set up event interceptors for tenant-sensitive operations
  interceptTenantSensitiveEvents(socket, config);
}

function validateRoomAccess(user: any, room: string, config: TenantIsolationConfig): boolean {
  // Parse room format: type:id or type:tenant:id
  const roomParts = room.split(':');
  
  if (roomParts.length < 2) {
    // Invalid room format, allow for now (could be Socket.IO internal rooms)
    return true;
  }

  const roomType = roomParts[0];
  const roomTenantId = getRoomTenantId(room, roomParts);

  // Always allow user's own tenant rooms
  if (roomTenantId === user.tenantId) {
    return true;
  }

  // Check if user has cross-tenant permissions
  if (config.allowedCrosstenantRoles?.includes(user.role)) {
    if (config.auditCrosstenantAccess) {
      logger.info({
        userId: user.id,
        userTenantId: user.tenantId,
        userRole: user.role,
        accessedRoom: room,
        accessedTenantId: roomTenantId
      }, 'Cross-tenant room access granted');
    }
    return true;
  }

  // Special cases for system-wide rooms
  if (isSystemRoom(roomType)) {
    return hasSystemRoomAccess(user, roomType);
  }

  // In strict mode, block all cross-tenant access
  if (config.strictMode) {
    return false;
  }

  // In non-strict mode, allow some cross-tenant operations based on permissions
  return hasPermissionForCrossTenantAccess(user, roomType);
}

function getRoomTenantId(room: string, roomParts: string[]): string | null {
  // Room formats:
  // tenant:tenantId
  // conversation:conversationId (tenant extracted from conversation)
  // user:userId (tenant extracted from user)
  // notification:tenantId
  // collaboration:conversationId

  const roomType = roomParts[0];

  switch (roomType) {
    case 'tenant':
    case 'notification':
      return roomParts[1] || null;
    
    case 'conversation':
    case 'collaboration':
      // Would need to look up conversation to get tenant ID
      // For now, extract from conversation ID if it follows a pattern
      return extractTenantFromConversationId(roomParts[1]);
    
    case 'user':
      // Would need to look up user to get tenant ID
      // For now, return null to allow user-specific rooms
      return extractTenantFromUserId(roomParts[1]);
    
    default:
      return null;
  }
}

function extractTenantFromConversationId(conversationId: string): string | null {
  // Implementation depends on your conversation ID format
  // Example: if conversation ID is "tenant123_conv456", extract "tenant123"
  const parts = conversationId.split('_');
  if (parts.length > 1 && parts[0].startsWith('tenant')) {
    return parts[0].substring(6); // Remove "tenant" prefix
  }
  return null;
}

function extractTenantFromUserId(userId: string): string | null {
  // Implementation depends on your user ID format
  // For now, return null to be permissive
  return null;
}

function isSystemRoom(roomType: string): boolean {
  const systemRoomTypes = ['admin', 'system', 'global', 'broadcast'];
  return systemRoomTypes.includes(roomType);
}

function hasSystemRoomAccess(user: any, roomType: string): boolean {
  switch (roomType) {
    case 'admin':
      return user.permissions?.includes('admin') || user.role === 'admin';
    
    case 'system':
    case 'global':
      return user.permissions?.includes('system_access') || user.role === 'admin';
    
    case 'broadcast':
      return user.permissions?.includes('receive_broadcasts') || user.role !== 'restricted';
    
    default:
      return false;
  }
}

function hasPermissionForCrossTenantAccess(user: any, roomType: string): boolean {
  // Define cross-tenant permissions based on room type
  const crossTenantPermissions = {
    'conversation': 'cross_tenant_conversations',
    'user': 'cross_tenant_users',
    'notification': 'cross_tenant_notifications',
    'collaboration': 'cross_tenant_collaboration'
  };

  const requiredPermission = crossTenantPermissions[roomType];
  return requiredPermission && user.permissions?.includes(requiredPermission);
}

function interceptTenantSensitiveEvents(socket: AuthenticatedSocket, config: TenantIsolationConfig) {
  // List of events that require tenant validation
  const tenantSensitiveEvents = [
    'join_conversation',
    'send_message',
    'stream_completion',
    'join_collaboration',
    'send_bulk_notification',
    'get_user_reactions'
  ];

  tenantSensitiveEvents.forEach(eventName => {
    const originalHandler = socket.listeners(eventName);
    
    socket.removeAllListeners(eventName);
    
    socket.on(eventName, (data: any, callback?: Function) => {
      if (validateEventTenantAccess(socket.user!, eventName, data, config)) {
        // Re-emit the event to original handlers
        originalHandler.forEach(handler => {
          if (typeof handler === 'function') {
            handler(data, callback);
          }
        });
      } else {
        logger.warn({
          userId: socket.user!.id,
          userTenantId: socket.user!.tenantId,
          eventName,
          eventData: data,
          socketId: socket.id
        }, 'Tenant isolation: Blocked event');

        socket.emit(SocketEvent.ERROR, {
          message: 'Access denied for event',
          event: eventName,
          reason: 'tenant_isolation',
          timestamp: new Date().toISOString()
        });

        if (callback && typeof callback === 'function') {
          callback({ error: 'Access denied: tenant isolation' });
        }
      }
    });
  });
}

function validateEventTenantAccess(
  user: any, 
  eventName: string, 
  data: any, 
  config: TenantIsolationConfig
): boolean {
  // Extract tenant context from event data
  const eventTenantId = extractTenantFromEventData(eventName, data);
  
  if (!eventTenantId) {
    // No tenant context in event, allow (might be handled by other validation)
    return true;
  }

  // Allow access to user's own tenant
  if (eventTenantId === user.tenantId) {
    return true;
  }

  // Check cross-tenant permissions
  if (config.allowedCrosstenantRoles?.includes(user.role)) {
    if (config.auditCrosstenantAccess) {
      logger.info({
        userId: user.id,
        userTenantId: user.tenantId,
        userRole: user.role,
        eventName,
        accessedTenantId: eventTenantId
      }, 'Cross-tenant event access granted');
    }
    return true;
  }

  return false;
}

function extractTenantFromEventData(eventName: string, data: any): string | null {
  // Extract tenant ID from various event data formats
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Direct tenant ID field
  if (data.tenantId) {
    return data.tenantId;
  }

  // Extract from conversation ID
  if (data.conversationId) {
    return extractTenantFromConversationId(data.conversationId);
  }

  // Extract from user IDs array (for bulk operations)
  if (data.userIds && Array.isArray(data.userIds) && data.userIds.length > 0) {
    // For bulk operations, would need to validate all target users belong to same tenant
    // For now, return null to allow other validation mechanisms
    return null;
  }

  // Extract from message ID
  if (data.messageId) {
    return extractTenantFromMessageId(data.messageId);
  }

  return null;
}

function extractTenantFromMessageId(messageId: string): string | null {
  // Implementation depends on your message ID format
  // For now, return null to be permissive
  return null;
}

// Utility functions for external use
export function createTenantRoom(roomType: RoomType, tenantId: string, identifier?: string): string {
  if (identifier) {
    return `${roomType}:${tenantId}:${identifier}`;
  }
  return `${roomType}:${tenantId}`;
}

export function parseTenantRoom(room: string): { type: string; tenantId: string | null; identifier?: string } {
  const parts = room.split(':');
  
  return {
    type: parts[0] || '',
    tenantId: parts[1] || null,
    identifier: parts[2]
  };
}

export function validateTenantAccess(user: any, targetTenantId: string, config: TenantIsolationConfig = defaultConfig): boolean {
  if (user.tenantId === targetTenantId) {
    return true;
  }

  return config.allowedCrosstenantRoles?.includes(user.role) || false;
}

// Middleware for tenant-specific namespaces
export function createTenantNamespace(tenantId: string) {
  return (socket: AuthenticatedSocket, next: (err?: any) => void) => {
    if (!socket.user) {
      return next(new Error('User not authenticated'));
    }

    // Validate user belongs to this tenant or has cross-tenant access
    if (socket.user.tenantId !== tenantId && 
        !defaultConfig.allowedCrosstenantRoles?.includes(socket.user.role)) {
      
      logger.warn({
        userId: socket.user.id,
        userTenantId: socket.user.tenantId,
        namespaceTenantId: tenantId,
        socketId: socket.id
      }, 'Access denied to tenant namespace');

      return next(new Error('Access denied to tenant namespace'));
    }

    next();
  };
}