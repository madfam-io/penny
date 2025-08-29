import { SocketEvent } from '../types';

/**
 * WebSocket event constants and utilities
 */

// Core Socket.IO events (built-in)
export const SOCKET_IO_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  DISCONNECTING: 'disconnecting',
  ERROR: 'error',
  CONNECT_ERROR: 'connect_error'
} as const;

// Authentication events
export const AUTH_EVENTS = {
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: SocketEvent.AUTHENTICATED,
  AUTHENTICATION_ERROR: SocketEvent.AUTHENTICATION_ERROR,
  TOKEN_REFRESH_REQUIRED: 'token_refresh_required',
  TOKEN_REFRESHED: 'token_refreshed',
  SESSION_EXPIRED: 'session_expired'
} as const;

// Connection lifecycle events
export const CONNECTION_EVENTS = {
  CONNECT: SocketEvent.CONNECT,
  DISCONNECT: SocketEvent.DISCONNECT,
  HEARTBEAT: SocketEvent.HEARTBEAT,
  PONG: SocketEvent.PONG,
  RECONNECT: 'reconnect',
  RECONNECTING: 'reconnecting',
  RECONNECT_ATTEMPT: 'reconnect_attempt',
  RECONNECT_ERROR: 'reconnect_error',
  RECONNECT_FAILED: 'reconnect_failed'
} as const;

// Room management events
export const ROOM_EVENTS = {
  JOIN_ROOM: SocketEvent.JOIN_ROOM,
  LEAVE_ROOM: SocketEvent.LEAVE_ROOM,
  ROOM_JOINED: SocketEvent.ROOM_JOINED,
  ROOM_LEFT: SocketEvent.ROOM_LEFT,
  USER_JOINED: SocketEvent.USER_JOINED,
  USER_LEFT: SocketEvent.USER_LEFT
} as const;

// Conversation events
export const CONVERSATION_EVENTS = {
  JOIN_CONVERSATION: SocketEvent.JOIN_CONVERSATION,
  LEAVE_CONVERSATION: SocketEvent.LEAVE_CONVERSATION,
  CONVERSATION_JOINED: SocketEvent.CONVERSATION_JOINED,
  CONVERSATION_LEFT: SocketEvent.CONVERSATION_LEFT,
  CONVERSATION_MESSAGES: SocketEvent.CONVERSATION_MESSAGES,
  CONVERSATION_CONTEXT: 'conversation_context'
} as const;

// Message events
export const MESSAGE_EVENTS = {
  SEND_MESSAGE: SocketEvent.SEND_MESSAGE,
  MESSAGE_SENT: SocketEvent.MESSAGE_SENT,
  MESSAGE_CREATED: SocketEvent.MESSAGE_CREATED,
  MESSAGE_UPDATED: SocketEvent.MESSAGE_UPDATED,
  MESSAGE_DELETED: SocketEvent.MESSAGE_DELETED,
  MESSAGE_REACTION: SocketEvent.MESSAGE_REACTION,
  MESSAGES_READ: 'messages_read',
  MARK_MESSAGES_READ: 'mark_messages_read',
  MESSAGES_MARKED_READ: 'messages_marked_read'
} as const;

// Streaming events
export const STREAM_EVENTS = {
  STREAM_START: SocketEvent.STREAM_START,
  STREAM_CHUNK: SocketEvent.STREAM_CHUNK,
  STREAM_COMPLETE: SocketEvent.STREAM_COMPLETE,
  STREAM_ERROR: SocketEvent.STREAM_ERROR,
  STREAM_COMPLETION: SocketEvent.STREAM_COMPLETION
} as const;

// Typing events
export const TYPING_EVENTS = {
  TYPING_START: SocketEvent.TYPING_START,
  TYPING_STOP: SocketEvent.TYPING_STOP,
  TYPING_STATUS: 'typing_status',
  GET_TYPING_USERS: 'get_typing_users',
  TYPING_USERS: 'typing_users'
} as const;

// Presence events
export const PRESENCE_EVENTS = {
  PRESENCE_UPDATE: SocketEvent.PRESENCE_UPDATE,
  USER_PRESENCE_CHANGED: SocketEvent.USER_PRESENCE_CHANGED,
  GET_PRESENCE: 'get_presence',
  GET_BULK_PRESENCE: 'get_bulk_presence',
  PRESENCE_DATA: 'presence_data'
} as const;

// Collaboration events
export const COLLABORATION_EVENTS = {
  JOIN_COLLABORATION: 'join_collaboration',
  LEAVE_COLLABORATION: 'leave_collaboration',
  COLLABORATION_SESSION_JOINED: 'collaboration_session_joined',
  COLLABORATION_PARTICIPANT_JOINED: 'collaboration_participant_joined',
  COLLABORATION_PARTICIPANT_LEFT: 'collaboration_participant_left',
  CURSOR_UPDATE: SocketEvent.CURSOR_UPDATE,
  CURSOR_MOVED: 'cursor_moved',
  SELECTION_UPDATE: SocketEvent.SELECTION_UPDATE,
  SELECTION_CHANGED: 'selection_changed',
  COLLABORATIVE_EDIT: SocketEvent.COLLABORATIVE_EDIT,
  DOCUMENT_LOCK: 'document_lock',
  DOCUMENT_UNLOCK: 'document_unlock',
  DOCUMENT_LOCKED: 'document_locked',
  DOCUMENT_UNLOCKED: 'document_unlocked',
  DOCUMENT_LOCK_FAILED: 'document_lock_failed'
} as const;

// Notification events
export const NOTIFICATION_EVENTS = {
  NOTIFICATION: SocketEvent.NOTIFICATION,
  NOTIFICATION_READ: SocketEvent.NOTIFICATION_READ,
  NOTIFICATION_DELIVERED: SocketEvent.NOTIFICATION_DELIVERED,
  NOTIFICATIONS_SYNC: 'notifications_sync',
  NOTIFICATIONS_LIST: 'notifications_list',
  NOTIFICATIONS_READ: 'notifications_read',
  NOTIFICATIONS_CLEARED: 'notifications_cleared',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  NOTIFICATION_PREFERENCES_UPDATED: 'notification_preferences_updated',
  GET_NOTIFICATIONS: 'get_notifications',
  CLEAR_NOTIFICATIONS: 'clear_notifications',
  SEND_BULK_NOTIFICATION: 'send_bulk_notification',
  BULK_NOTIFICATION_SENT: 'bulk_notification_sent',
  SEND_SYSTEM_NOTIFICATION: 'send_system_notification',
  SYSTEM_NOTIFICATION_SENT: 'system_notification_sent'
} as const;

// Reaction events
export const REACTION_EVENTS = {
  MESSAGE_REACTION: MESSAGE_EVENTS.MESSAGE_REACTION,
  BULK_MESSAGE_REACTIONS: 'bulk_message_reactions',
  BULK_REACTIONS_PROCESSED: 'bulk_reactions_processed',
  GET_MESSAGE_REACTIONS: 'get_message_reactions',
  MESSAGE_REACTIONS: 'message_reactions',
  GET_REACTION_STATS: 'get_reaction_stats',
  REACTION_STATS: 'reaction_stats',
  GET_USER_REACTIONS: 'get_user_reactions',
  USER_REACTIONS: 'user_reactions',
  CLEAR_MESSAGE_REACTIONS: 'clear_message_reactions',
  REACTIONS_CLEARED: 'reactions_cleared',
  MODERATE_REACTIONS: 'moderate_reactions',
  REACTION_MODERATED: 'reaction_moderated',
  REACTION_UPDATED: 'reaction_updated'
} as const;

// Error events
export const ERROR_EVENTS = {
  ERROR: SocketEvent.ERROR,
  RATE_LIMITED: SocketEvent.RATE_LIMITED,
  VALIDATION_ERROR: 'validation_error',
  PERMISSION_ERROR: 'permission_error',
  TENANT_ISOLATION_ERROR: 'tenant_isolation_error'
} as const;

// Admin events
export const ADMIN_EVENTS = {
  ADMIN_BROADCAST: 'admin_broadcast',
  SYSTEM_MAINTENANCE: 'system_maintenance',
  USER_MANAGEMENT: 'user_management',
  TENANT_MANAGEMENT: 'tenant_management',
  HEALTH_CHECK: 'health_check',
  METRICS_REPORT: 'metrics_report'
} as const;

// Event categories for organization
export const EVENT_CATEGORIES = {
  CORE: [
    ...Object.values(SOCKET_IO_EVENTS),
    ...Object.values(CONNECTION_EVENTS)
  ],
  AUTHENTICATION: Object.values(AUTH_EVENTS),
  ROOMS: Object.values(ROOM_EVENTS),
  CONVERSATIONS: Object.values(CONVERSATION_EVENTS),
  MESSAGES: Object.values(MESSAGE_EVENTS),
  STREAMING: Object.values(STREAM_EVENTS),
  TYPING: Object.values(TYPING_EVENTS),
  PRESENCE: Object.values(PRESENCE_EVENTS),
  COLLABORATION: Object.values(COLLABORATION_EVENTS),
  NOTIFICATIONS: Object.values(NOTIFICATION_EVENTS),
  REACTIONS: Object.values(REACTION_EVENTS),
  ERRORS: Object.values(ERROR_EVENTS),
  ADMIN: Object.values(ADMIN_EVENTS)
} as const;

// All events combined
export const ALL_EVENTS = Object.values(EVENT_CATEGORIES).flat();

// Event validation utilities
export class EventValidator {
  private static readonly VALID_EVENTS = new Set(ALL_EVENTS);

  static isValidEvent(event: string): boolean {
    return this.VALID_EVENTS.has(event);
  }

  static getEventCategory(event: string): keyof typeof EVENT_CATEGORIES | null {
    for (const [category, events] of Object.entries(EVENT_CATEGORIES)) {
      if (events.includes(event as any)) {
        return category as keyof typeof EVENT_CATEGORIES;
      }
    }
    return null;
  }

  static validateEventData(event: string, data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.isValidEvent(event)) {
      errors.push(`Unknown event: ${event}`);
      return { valid: false, errors };
    }

    // Basic data validation based on event type
    switch (event) {
      case MESSAGE_EVENTS.SEND_MESSAGE:
        if (!data?.conversationId) errors.push('conversationId is required');
        if (!data?.content) errors.push('content is required');
        break;

      case CONVERSATION_EVENTS.JOIN_CONVERSATION:
        if (!data?.conversationId) errors.push('conversationId is required');
        break;

      case PRESENCE_EVENTS.PRESENCE_UPDATE:
        if (!data?.status) errors.push('status is required');
        break;

      case NOTIFICATION_EVENTS.NOTIFICATION_READ:
        if (!data?.notificationIds) errors.push('notificationIds is required');
        break;

      case TYPING_EVENTS.TYPING_START:
      case TYPING_EVENTS.TYPING_STOP:
        if (!data?.conversationId) errors.push('conversationId is required');
        break;

      case MESSAGE_EVENTS.MESSAGE_REACTION:
        if (!data?.messageId) errors.push('messageId is required');
        if (!data?.reaction) errors.push('reaction is required');
        if (!['add', 'remove'].includes(data?.action)) {
          errors.push('action must be "add" or "remove"');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }
}

// Event rate limiting configurations
export const EVENT_RATE_LIMITS = {
  // High-frequency events (more permissive)
  [TYPING_EVENTS.TYPING_START]: { points: 120, duration: 60000 },
  [TYPING_EVENTS.TYPING_STOP]: { points: 120, duration: 60000 },
  [PRESENCE_EVENTS.PRESENCE_UPDATE]: { points: 60, duration: 60000 },
  [CONNECTION_EVENTS.HEARTBEAT]: { points: 200, duration: 60000 },

  // Medium-frequency events
  [MESSAGE_EVENTS.SEND_MESSAGE]: { points: 30, duration: 60000 },
  [MESSAGE_EVENTS.MESSAGE_REACTION]: { points: 60, duration: 60000 },
  [CONVERSATION_EVENTS.JOIN_CONVERSATION]: { points: 50, duration: 60000 },
  [CONVERSATION_EVENTS.LEAVE_CONVERSATION]: { points: 50, duration: 60000 },

  // Low-frequency events (more restrictive)
  [NOTIFICATION_EVENTS.SEND_BULK_NOTIFICATION]: { points: 5, duration: 60000 },
  [ADMIN_EVENTS.ADMIN_BROADCAST]: { points: 3, duration: 60000 },
  [REACTION_EVENTS.BULK_MESSAGE_REACTIONS]: { points: 10, duration: 60000 },

  // Default rate limit for unspecified events
  DEFAULT: { points: 100, duration: 60000 }
} as const;

// Event priority levels (for handling during high load)
export const EVENT_PRIORITIES = {
  CRITICAL: [
    CONNECTION_EVENTS.CONNECT,
    CONNECTION_EVENTS.DISCONNECT,
    AUTH_EVENTS.AUTHENTICATE,
    ERROR_EVENTS.ERROR
  ],
  HIGH: [
    MESSAGE_EVENTS.SEND_MESSAGE,
    STREAM_EVENTS.STREAM_COMPLETION,
    NOTIFICATION_EVENTS.NOTIFICATION
  ],
  MEDIUM: [
    MESSAGE_EVENTS.MESSAGE_REACTION,
    CONVERSATION_EVENTS.JOIN_CONVERSATION,
    PRESENCE_EVENTS.PRESENCE_UPDATE
  ],
  LOW: [
    TYPING_EVENTS.TYPING_START,
    TYPING_EVENTS.TYPING_STOP,
    CONNECTION_EVENTS.HEARTBEAT
  ]
} as const;

// Event logging levels
export const EVENT_LOG_LEVELS = {
  DEBUG: [
    CONNECTION_EVENTS.HEARTBEAT,
    CONNECTION_EVENTS.PONG,
    TYPING_EVENTS.TYPING_START,
    TYPING_EVENTS.TYPING_STOP
  ],
  INFO: [
    MESSAGE_EVENTS.SEND_MESSAGE,
    CONVERSATION_EVENTS.JOIN_CONVERSATION,
    PRESENCE_EVENTS.PRESENCE_UPDATE
  ],
  WARN: [
    ERROR_EVENTS.RATE_LIMITED,
    ERROR_EVENTS.PERMISSION_ERROR
  ],
  ERROR: [
    ERROR_EVENTS.ERROR,
    AUTH_EVENTS.AUTHENTICATION_ERROR,
    CONNECTION_EVENTS.CONNECT_ERROR
  ]
} as const;

// Utility functions
export function getEventPriority(event: string): keyof typeof EVENT_PRIORITIES | 'NORMAL' {
  for (const [priority, events] of Object.entries(EVENT_PRIORITIES)) {
    if (events.includes(event as any)) {
      return priority as keyof typeof EVENT_PRIORITIES;
    }
  }
  return 'NORMAL';
}

export function getEventLogLevel(event: string): keyof typeof EVENT_LOG_LEVELS | 'INFO' {
  for (const [level, events] of Object.entries(EVENT_LOG_LEVELS)) {
    if (events.includes(event as any)) {
      return level as keyof typeof EVENT_LOG_LEVELS;
    }
  }
  return 'INFO';
}

export function getEventRateLimit(event: string): { points: number; duration: number } {
  return EVENT_RATE_LIMITS[event as keyof typeof EVENT_RATE_LIMITS] || EVENT_RATE_LIMITS.DEFAULT;
}

export function isHighPriorityEvent(event: string): boolean {
  return EVENT_PRIORITIES.CRITICAL.includes(event as any) || 
         EVENT_PRIORITIES.HIGH.includes(event as any);
}

export function isUserFacingEvent(event: string): boolean {
  // Events that directly impact user experience
  const userFacingEvents = [
    ...Object.values(MESSAGE_EVENTS),
    ...Object.values(NOTIFICATION_EVENTS),
    ...Object.values(PRESENCE_EVENTS),
    ...Object.values(TYPING_EVENTS),
    ...Object.values(COLLABORATION_EVENTS)
  ];
  
  return userFacingEvents.includes(event as any);
}

export function shouldAuditEvent(event: string): boolean {
  // Events that should be audited for compliance/security
  const auditableEvents = [
    AUTH_EVENTS.AUTHENTICATE,
    AUTH_EVENTS.AUTHENTICATION_ERROR,
    MESSAGE_EVENTS.SEND_MESSAGE,
    MESSAGE_EVENTS.MESSAGE_DELETED,
    ADMIN_EVENTS.ADMIN_BROADCAST,
    NOTIFICATION_EVENTS.SEND_BULK_NOTIFICATION,
    REACTION_EVENTS.MODERATE_REACTIONS
  ];
  
  return auditableEvents.includes(event as any);
}

// Event middleware utilities
export function createEventMiddleware(
  event: string,
  handler: (data: any, callback?: Function) => void | Promise<void>
) {
  return async (data: any, callback?: Function) => {
    const validation = EventValidator.validateEventData(event, data);
    
    if (!validation.valid) {
      const error = new Error(`Invalid event data for ${event}: ${validation.errors.join(', ')}`);
      if (callback) {
        callback({ error: error.message });
      } else {
        throw error;
      }
      return;
    }

    try {
      await handler(data, callback);
    } catch (error) {
      if (callback) {
        callback({ error: error.message });
      } else {
        throw error;
      }
    }
  };
}

// Export all constants and utilities
export default {
  SOCKET_IO_EVENTS,
  AUTH_EVENTS,
  CONNECTION_EVENTS,
  ROOM_EVENTS,
  CONVERSATION_EVENTS,
  MESSAGE_EVENTS,
  STREAM_EVENTS,
  TYPING_EVENTS,
  PRESENCE_EVENTS,
  COLLABORATION_EVENTS,
  NOTIFICATION_EVENTS,
  REACTION_EVENTS,
  ERROR_EVENTS,
  ADMIN_EVENTS,
  EVENT_CATEGORIES,
  ALL_EVENTS,
  EVENT_RATE_LIMITS,
  EVENT_PRIORITIES,
  EVENT_LOG_LEVELS,
  EventValidator,
  getEventPriority,
  getEventLogLevel,
  getEventRateLimit,
  isHighPriorityEvent,
  isUserFacingEvent,
  shouldAuditEvent,
  createEventMiddleware
};