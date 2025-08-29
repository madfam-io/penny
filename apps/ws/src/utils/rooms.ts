import { RoomType } from '../types';

/**
 * Utility functions for WebSocket room naming and management
 */

// Room naming conventions
export const ROOM_SEPARATORS = {
  TYPE: ':',
  TENANT: ':',
  ID: ':',
  NAMESPACE: '.'
} as const;

// Room type prefixes
export const ROOM_PREFIXES = {
  [RoomType.CONVERSATION]: 'conversation',
  [RoomType.TENANT]: 'tenant',
  [RoomType.USER]: 'user',
  [RoomType.ADMIN]: 'admin',
  [RoomType.NOTIFICATION]: 'notification'
} as const;

// Special room names
export const SPECIAL_ROOMS = {
  GLOBAL_BROADCAST: 'global.broadcast',
  SYSTEM_ALERTS: 'system.alerts',
  ADMIN_CONSOLE: 'admin.console',
  HEALTH_MONITOR: 'health.monitor'
} as const;

/**
 * Create a standardized room name
 */
export function createRoomName(
  type: RoomType,
  identifier: string,
  tenantId?: string,
  namespace?: string
): string {
  const parts: string[] = [];
  
  // Add namespace if provided
  if (namespace) {
    parts.push(namespace);
    parts.push(ROOM_SEPARATORS.NAMESPACE);
  }
  
  // Add room type prefix
  parts.push(ROOM_PREFIXES[type]);
  parts.push(ROOM_SEPARATORS.TYPE);
  
  // Add tenant ID for tenant-specific rooms
  if (tenantId && type !== RoomType.ADMIN) {
    parts.push(tenantId);
    parts.push(ROOM_SEPARATORS.TENANT);
  }
  
  // Add identifier
  parts.push(identifier);
  
  return parts.join('');
}

/**
 * Parse a room name into its components
 */
export function parseRoomName(roomName: string): {
  namespace?: string;
  type: RoomType | null;
  tenantId?: string;
  identifier: string;
  isValid: boolean;
} {
  const result = {
    namespace: undefined as string | undefined,
    type: null as RoomType | null,
    tenantId: undefined as string | undefined,
    identifier: '',
    isValid: false
  };

  try {
    let remaining = roomName;
    
    // Check for namespace
    const namespaceSeparatorIndex = remaining.indexOf(ROOM_SEPARATORS.NAMESPACE);
    if (namespaceSeparatorIndex > 0) {
      result.namespace = remaining.substring(0, namespaceSeparatorIndex);
      remaining = remaining.substring(namespaceSeparatorIndex + 1);
    }
    
    // Parse room type
    const typeSeparatorIndex = remaining.indexOf(ROOM_SEPARATORS.TYPE);
    if (typeSeparatorIndex === -1) {
      return result;
    }
    
    const typePrefix = remaining.substring(0, typeSeparatorIndex);
    remaining = remaining.substring(typeSeparatorIndex + 1);
    
    // Find matching room type
    for (const [roomType, prefix] of Object.entries(ROOM_PREFIXES)) {
      if (prefix === typePrefix) {
        result.type = roomType as RoomType;
        break;
      }
    }
    
    if (!result.type) {
      return result;
    }
    
    // For non-admin rooms, check for tenant ID
    if (result.type !== RoomType.ADMIN) {
      const tenantSeparatorIndex = remaining.indexOf(ROOM_SEPARATORS.TENANT);
      if (tenantSeparatorIndex > 0) {
        result.tenantId = remaining.substring(0, tenantSeparatorIndex);
        remaining = remaining.substring(tenantSeparatorIndex + 1);
      }
    }
    
    // Remaining part is the identifier
    result.identifier = remaining;
    result.isValid = result.identifier.length > 0;
    
  } catch (error) {
    result.isValid = false;
  }
  
  return result;
}

/**
 * Create conversation room name
 */
export function createConversationRoom(
  conversationId: string,
  tenantId: string,
  namespace?: string
): string {
  return createRoomName(RoomType.CONVERSATION, conversationId, tenantId, namespace);
}

/**
 * Create tenant-wide room name
 */
export function createTenantRoom(
  tenantId: string,
  purpose: string = 'general',
  namespace?: string
): string {
  return createRoomName(RoomType.TENANT, purpose, tenantId, namespace);
}

/**
 * Create user-specific room name
 */
export function createUserRoom(
  userId: string,
  tenantId: string,
  purpose: string = 'notifications',
  namespace?: string
): string {
  return createRoomName(RoomType.USER, `${userId}.${purpose}`, tenantId, namespace);
}

/**
 * Create admin room name
 */
export function createAdminRoom(
  purpose: string = 'console',
  namespace?: string
): string {
  return createRoomName(RoomType.ADMIN, purpose, undefined, namespace);
}

/**
 * Create notification room name
 */
export function createNotificationRoom(
  scope: 'user' | 'tenant' | 'global',
  identifier: string,
  tenantId?: string,
  namespace?: string
): string {
  const roomId = scope === 'global' ? identifier : `${scope}.${identifier}`;
  return createRoomName(RoomType.NOTIFICATION, roomId, tenantId, namespace);
}

/**
 * Create collaboration room name
 */
export function createCollaborationRoom(
  conversationId: string,
  tenantId: string,
  namespace?: string
): string {
  return createConversationRoom(`collab.${conversationId}`, tenantId, namespace);
}

/**
 * Create typing room name
 */
export function createTypingRoom(
  conversationId: string,
  tenantId: string,
  namespace?: string
): string {
  return createConversationRoom(`typing.${conversationId}`, tenantId, namespace);
}

/**
 * Create presence room name
 */
export function createPresenceRoom(
  scope: 'tenant' | 'conversation',
  identifier: string,
  tenantId: string,
  namespace?: string
): string {
  const roomId = `presence.${scope}.${identifier}`;
  return createRoomName(RoomType.TENANT, roomId, tenantId, namespace);
}

/**
 * Validate room name format
 */
export function validateRoomName(roomName: string): boolean {
  const parsed = parseRoomName(roomName);
  return parsed.isValid;
}

/**
 * Check if room belongs to tenant
 */
export function isRoomInTenant(roomName: string, tenantId: string): boolean {
  const parsed = parseRoomName(roomName);
  return parsed.isValid && parsed.tenantId === tenantId;
}

/**
 * Get room type from room name
 */
export function getRoomType(roomName: string): RoomType | null {
  const parsed = parseRoomName(roomName);
  return parsed.type;
}

/**
 * Get tenant ID from room name
 */
export function getTenantIdFromRoom(roomName: string): string | null {
  const parsed = parseRoomName(roomName);
  return parsed.tenantId || null;
}

/**
 * Check if user should have access to room
 */
export function canUserAccessRoom(
  roomName: string,
  userId: string,
  tenantId: string,
  userRole: string,
  userPermissions: string[]
): boolean {
  const parsed = parseRoomName(roomName);
  
  if (!parsed.isValid) {
    return false;
  }
  
  // Check tenant isolation
  if (parsed.tenantId && parsed.tenantId !== tenantId) {
    // Only allow cross-tenant access for admins
    return userRole === 'admin' || userPermissions.includes('cross_tenant_access');
  }
  
  // Check room type permissions
  switch (parsed.type) {
    case RoomType.ADMIN:
      return userRole === 'admin' || userPermissions.includes('admin_access');
    
    case RoomType.USER:
      // Check if it's the user's own room
      const userIdFromRoom = parsed.identifier.split('.')[0];
      return userIdFromRoom === userId || 
             userRole === 'admin' || 
             userPermissions.includes('access_other_users');
    
    case RoomType.CONVERSATION:
    case RoomType.TENANT:
    case RoomType.NOTIFICATION:
      // Basic tenant membership required
      return true;
    
    default:
      return false;
  }
}

/**
 * Generate room patterns for subscription
 */
export function generateRoomPatterns(tenantId: string, userId: string): string[] {
  const patterns: string[] = [];
  
  // User-specific rooms
  patterns.push(createUserRoom(userId, tenantId, '*'));
  
  // Tenant-wide rooms
  patterns.push(createTenantRoom(tenantId, '*'));
  
  // Conversations in tenant
  patterns.push(createConversationRoom('*', tenantId));
  
  // Notifications
  patterns.push(createNotificationRoom('user', userId, tenantId));
  patterns.push(createNotificationRoom('tenant', '*', tenantId));
  
  return patterns;
}

/**
 * Room hierarchy utilities
 */
export const RoomHierarchy = {
  /**
   * Get parent rooms for a given room
   */
  getParentRooms(roomName: string): string[] {
    const parsed = parseRoomName(roomName);
    const parents: string[] = [];
    
    if (!parsed.isValid) return parents;
    
    // Add tenant room as parent for all tenant-scoped rooms
    if (parsed.tenantId) {
      parents.push(createTenantRoom(parsed.tenantId));
    }
    
    // Add namespace parent if applicable
    if (parsed.namespace) {
      const withoutNamespace = roomName.substring(parsed.namespace.length + 1);
      parents.push(withoutNamespace);
    }
    
    return parents;
  },
  
  /**
   * Get child room patterns
   */
  getChildRoomPatterns(roomName: string): string[] {
    const parsed = parseRoomName(roomName);
    const patterns: string[] = [];
    
    if (!parsed.isValid) return patterns;
    
    switch (parsed.type) {
      case RoomType.TENANT:
        // All conversations in tenant
        patterns.push(createConversationRoom('*', parsed.tenantId!));
        // All user rooms in tenant
        patterns.push(createUserRoom('*', parsed.tenantId!));
        break;
      
      case RoomType.CONVERSATION:
        // Collaboration and typing rooms for conversation
        patterns.push(createCollaborationRoom(parsed.identifier, parsed.tenantId!));
        patterns.push(createTypingRoom(parsed.identifier, parsed.tenantId!));
        break;
    }
    
    return patterns;
  }
};

/**
 * Room utilities for Socket.IO
 */
export const SocketRoomUtils = {
  /**
   * Get all rooms a user should join on connect
   */
  getAutoJoinRooms(userId: string, tenantId: string, userRole: string): string[] {
    const rooms: string[] = [];
    
    // User's personal notification room
    rooms.push(createUserRoom(userId, tenantId, 'notifications'));
    
    // Tenant general room
    rooms.push(createTenantRoom(tenantId, 'general'));
    
    // Global broadcast room (low-priority)
    rooms.push(SPECIAL_ROOMS.GLOBAL_BROADCAST);
    
    // Admin rooms if applicable
    if (userRole === 'admin') {
      rooms.push(createAdminRoom('console'));
      rooms.push(SPECIAL_ROOMS.SYSTEM_ALERTS);
    }
    
    return rooms;
  },
  
  /**
   * Get conversation-specific rooms
   */
  getConversationRooms(conversationId: string, tenantId: string): string[] {
    return [
      createConversationRoom(conversationId, tenantId),
      createCollaborationRoom(conversationId, tenantId),
      createTypingRoom(conversationId, tenantId),
      createPresenceRoom('conversation', conversationId, tenantId)
    ];
  },
  
  /**
   * Clean up room name for Socket.IO
   */
  sanitizeRoomName(roomName: string): string {
    // Remove any characters that might cause issues with Socket.IO
    return roomName.replace(/[^\w\-.:]/g, '_');
  },
  
  /**
   * Check if room name is reserved
   */
  isReservedRoom(roomName: string): boolean {
    return Object.values(SPECIAL_ROOMS).includes(roomName as any);
  }
};

/**
 * Room metrics and monitoring
 */
export const RoomMetrics = {
  /**
   * Extract metrics labels from room name
   */
  getRoomLabels(roomName: string): Record<string, string> {
    const parsed = parseRoomName(roomName);
    const labels: Record<string, string> = {
      room_type: parsed.type || 'unknown',
      valid: parsed.isValid.toString()
    };
    
    if (parsed.namespace) {
      labels.namespace = parsed.namespace;
    }
    
    if (parsed.tenantId) {
      labels.tenant_id = parsed.tenantId;
    }
    
    return labels;
  },
  
  /**
   * Get room category for metrics
   */
  getRoomCategory(roomName: string): string {
    const parsed = parseRoomName(roomName);
    
    if (!parsed.isValid) return 'invalid';
    
    switch (parsed.type) {
      case RoomType.CONVERSATION:
        return parsed.identifier.startsWith('collab.') ? 'collaboration' :
               parsed.identifier.startsWith('typing.') ? 'typing' : 'conversation';
      case RoomType.USER:
        return 'user_notifications';
      case RoomType.TENANT:
        return 'tenant_broadcast';
      case RoomType.ADMIN:
        return 'admin';
      case RoomType.NOTIFICATION:
        return 'notifications';
      default:
        return 'other';
    }
  }
};

// Export all utilities
export default {
  createRoomName,
  parseRoomName,
  createConversationRoom,
  createTenantRoom,
  createUserRoom,
  createAdminRoom,
  createNotificationRoom,
  createCollaborationRoom,
  createTypingRoom,
  createPresenceRoom,
  validateRoomName,
  isRoomInTenant,
  getRoomType,
  getTenantIdFromRoom,
  canUserAccessRoom,
  generateRoomPatterns,
  RoomHierarchy,
  SocketRoomUtils,
  RoomMetrics,
  ROOM_PREFIXES,
  SPECIAL_ROOMS
};