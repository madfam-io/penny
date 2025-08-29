import { z } from 'zod';
import {
  JoinRoomSchema,
  JoinConversationSchema,
  SendMessageSchema,
  StreamCompletionSchema,
  TypingSchema,
  PresenceUpdateSchema,
  MessageReactionSchema,
  CursorUpdateSchema,
  NotificationSchema,
  SocketEvent,
  RoomType,
  PresenceStatus,
  MessageType
} from '../types';

/**
 * Comprehensive validation schemas and utilities for WebSocket events
 */

// Extended validation schemas
export const ExtendedValidationSchemas = {
  // Enhanced message validation
  EnhancedSendMessage: SendMessageSchema.extend({
    temporaryId: z.string().optional(), // Client-side temporary ID for optimistic updates
    mentions: z.array(z.string()).optional(), // User IDs mentioned in the message
    threadId: z.string().optional(), // Thread/reply context
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    scheduleFor: z.date().optional(), // Scheduled message delivery
    expiresAt: z.date().optional(), // Message expiration
    isEdited: z.boolean().default(false),
    originalMessageId: z.string().optional() // For edited messages
  }),

  // Room management with permissions
  EnhancedJoinRoom: JoinRoomSchema.extend({
    password: z.string().optional(), // Room password if required
    inviteCode: z.string().optional(), // Invitation code
    requestedPermissions: z.array(z.string()).optional(),
    clientCapabilities: z.object({
      supportsFileUpload: z.boolean().default(false),
      supportsVideoCall: z.boolean().default(false),
      supportsScreenShare: z.boolean().default(false),
      maxFileSize: z.number().optional()
    }).optional()
  }),

  // Enhanced presence with rich status
  RichPresenceUpdate: PresenceUpdateSchema.extend({
    activity: z.object({
      type: z.enum(['typing', 'reading', 'composing', 'idle']).optional(),
      details: z.string().max(100).optional(),
      timestamp: z.date().optional()
    }).optional(),
    device: z.object({
      type: z.enum(['desktop', 'mobile', 'tablet', 'web']).optional(),
      os: z.string().max(50).optional(),
      browser: z.string().max(50).optional()
    }).optional(),
    location: z.object({
      timezone: z.string().optional(),
      country: z.string().length(2).optional() // ISO country code
    }).optional()
  }),

  // File upload validation
  FileUpload: z.object({
    conversationId: z.string(),
    files: z.array(z.object({
      name: z.string().min(1).max(255),
      size: z.number().positive().max(100 * 1024 * 1024), // 100MB max
      type: z.string().min(1).max(100),
      checksum: z.string().optional(), // For integrity verification
      isPublic: z.boolean().default(false)
    })).min(1).max(10), // Max 10 files at once
    uploadIntent: z.enum(['attachment', 'avatar', 'document', 'image']).default('attachment')
  }),

  // Voice/Video call signaling
  CallSignaling: z.object({
    conversationId: z.string(),
    callId: z.string(),
    action: z.enum(['initiate', 'accept', 'reject', 'end', 'mute', 'unmute']),
    participants: z.array(z.string()).optional(),
    mediaType: z.enum(['audio', 'video', 'screen']).default('audio'),
    sdp: z.string().optional(), // WebRTC Session Description Protocol
    candidate: z.object({
      candidate: z.string(),
      sdpMid: z.string(),
      sdpMLineIndex: z.number()
    }).optional()
  }),

  // Advanced search
  MessageSearch: z.object({
    query: z.string().min(1).max(500),
    conversationIds: z.array(z.string()).max(20).optional(),
    userIds: z.array(z.string()).max(10).optional(),
    messageTypes: z.array(z.nativeEnum(MessageType)).optional(),
    dateRange: z.object({
      start: z.date(),
      end: z.date()
    }).optional(),
    hasAttachments: z.boolean().optional(),
    hasReactions: z.boolean().optional(),
    limit: z.number().int().positive().max(100).default(20),
    offset: z.number().int().nonnegative().default(0),
    sortBy: z.enum(['relevance', 'date', 'reactions']).default('relevance'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  }),

  // Bulk operations
  BulkMessageOperation: z.object({
    messageIds: z.array(z.string()).min(1).max(50),
    operation: z.enum(['delete', 'archive', 'pin', 'unpin', 'mark_important']),
    reason: z.string().max(500).optional() // For moderation actions
  }),

  // Analytics events
  AnalyticsEvent: z.object({
    eventType: z.enum(['message_sent', 'file_shared', 'reaction_added', 'user_mentioned']),
    properties: z.record(z.unknown()).optional(),
    timestamp: z.date().default(() => new Date()),
    sessionId: z.string().optional()
  }),

  // Webhook configuration
  WebhookConfig: z.object({
    url: z.string().url(),
    events: z.array(z.string()).min(1),
    secret: z.string().min(8).max(100),
    active: z.boolean().default(true),
    retryCount: z.number().int().nonnegative().max(5).default(3)
  })
};

// Validation error types
export class ValidationError extends Error {
  public field: string;
  public code: string;
  public details: any;

  constructor(message: string, field: string, code: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
    this.details = details;
  }
}

// Custom validation functions
export const CustomValidators = {
  // Validate emoji reactions
  isValidEmoji: (value: string): boolean => {
    // Basic emoji regex - in production, use a proper emoji library
    const emojiRegex = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/;
    return emojiRegex.test(value);
  },

  // Validate conversation ID format
  isValidConversationId: (value: string): boolean => {
    // Expected format: tenant_id:conversation_uuid
    const conversationIdRegex = /^[a-zA-Z0-9_-]+:[a-fA-F0-9-]+$/;
    return conversationIdRegex.test(value) && value.length <= 100;
  },

  // Validate user mention format
  isValidMention: (value: string): boolean => {
    // Expected format: @userId or @[Display Name](userId)
    const mentionRegex = /^@(?:\[.+\]\(.+\)|[a-zA-Z0-9_-]+)$/;
    return mentionRegex.test(value);
  },

  // Validate file type
  isAllowedFileType: (mimeType: string, category: 'image' | 'document' | 'video' | 'audio' | 'any' = 'any'): boolean => {
    const allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      document: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      video: ['video/mp4', 'video/webm', 'video/ogg'],
      audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'],
      any: [] // Will be populated below
    };

    // Populate 'any' with all allowed types
    allowedTypes.any = Object.values(allowedTypes).flat();

    return allowedTypes[category].includes(mimeType);
  },

  // Validate timezone
  isValidTimezone: (value: string): boolean => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },

  // Validate ISO country code
  isValidCountryCode: (value: string): boolean => {
    const countryCodes = ['US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU', 'BR', 'MX', 'IN', 'CN']; // Add more as needed
    return countryCodes.includes(value.toUpperCase());
  }
};

// Schema builders for dynamic validation
export const SchemaBuilders = {
  // Create pagination schema
  createPaginationSchema: (maxLimit = 100) => z.object({
    limit: z.number().int().positive().max(maxLimit).default(20),
    offset: z.number().int().nonnegative().default(0),
    cursor: z.string().optional()
  }),

  // Create date range schema
  createDateRangeSchema: (maxRangeDays = 30) => z.object({
    start: z.date(),
    end: z.date()
  }).refine(data => {
    const diffDays = (data.end.getTime() - data.start.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= maxRangeDays && diffDays >= 0;
  }, {
    message: `Date range cannot exceed ${maxRangeDays} days and end must be after start`
  }),

  // Create permissions schema
  createPermissionsSchema: (validPermissions: string[]) => z.object({
    permissions: z.array(z.enum(validPermissions as [string, ...string[]])).min(1)
  }),

  // Create tenant-scoped ID schema
  createTenantScopedIdSchema: (resourceType: string) => z.string().refine(
    value => value.includes(':') && value.split(':').length === 2,
    {
      message: `${resourceType} ID must be in format 'tenantId:resourceId'`
    }
  )
};

// Event-specific validators
export const EventValidators = {
  [SocketEvent.SEND_MESSAGE]: (data: any) => {
    const result = ExtendedValidationSchemas.EnhancedSendMessage.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        'Invalid message data',
        'message',
        'INVALID_MESSAGE_DATA',
        result.error.errors
      );
    }
    return result.data;
  },

  [SocketEvent.JOIN_CONVERSATION]: (data: any) => {
    const result = JoinConversationSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        'Invalid conversation join data',
        'conversation',
        'INVALID_JOIN_DATA',
        result.error.errors
      );
    }
    
    // Additional custom validation
    if (!CustomValidators.isValidConversationId(result.data.conversationId)) {
      throw new ValidationError(
        'Invalid conversation ID format',
        'conversationId',
        'INVALID_FORMAT'
      );
    }
    
    return result.data;
  },

  [SocketEvent.MESSAGE_REACTION]: (data: any) => {
    const result = MessageReactionSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        'Invalid reaction data',
        'reaction',
        'INVALID_REACTION_DATA',
        result.error.errors
      );
    }
    
    // Validate emoji
    if (!CustomValidators.isValidEmoji(result.data.reaction)) {
      throw new ValidationError(
        'Invalid emoji reaction',
        'reaction',
        'INVALID_EMOJI'
      );
    }
    
    return result.data;
  },

  [SocketEvent.PRESENCE_UPDATE]: (data: any) => {
    const result = ExtendedValidationSchemas.RichPresenceUpdate.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        'Invalid presence data',
        'presence',
        'INVALID_PRESENCE_DATA',
        result.error.errors
      );
    }
    
    // Validate timezone if provided
    if (result.data.location?.timezone && 
        !CustomValidators.isValidTimezone(result.data.location.timezone)) {
      throw new ValidationError(
        'Invalid timezone',
        'timezone',
        'INVALID_TIMEZONE'
      );
    }
    
    return result.data;
  },

  // File upload validation
  'file_upload': (data: any) => {
    const result = ExtendedValidationSchemas.FileUpload.safeParse(data);
    if (!result.success) {
      throw new ValidationError(
        'Invalid file upload data',
        'files',
        'INVALID_UPLOAD_DATA',
        result.error.errors
      );
    }
    
    // Validate file types based on upload intent
    for (const file of result.data.files) {
      let allowedCategory: 'image' | 'document' | 'video' | 'audio' | 'any' = 'any';
      
      if (result.data.uploadIntent === 'image') allowedCategory = 'image';
      if (result.data.uploadIntent === 'document') allowedCategory = 'document';
      
      if (!CustomValidators.isAllowedFileType(file.type, allowedCategory)) {
        throw new ValidationError(
          `File type ${file.type} not allowed for ${result.data.uploadIntent}`,
          'fileType',
          'INVALID_FILE_TYPE',
          { fileName: file.name, fileType: file.type }
        );
      }
    }
    
    return result.data;
  }
};

// Sanitization functions
export const Sanitizers = {
  // Sanitize message content
  sanitizeMessage: (content: string): string => {
    return content
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .substring(0, 50000); // Ensure max length
  },

  // Sanitize user input for search
  sanitizeSearchQuery: (query: string): string => {
    return query
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 500);
  },

  // Sanitize room names
  sanitizeRoomName: (name: string): string => {
    return name
      .replace(/[^\w\-.:]/g, '_') // Replace invalid characters
      .toLowerCase()
      .substring(0, 100);
  },

  // Extract and validate mentions from content
  extractMentions: (content: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    
    return [...new Set(mentions)]; // Remove duplicates
  }
};

// Rate limiting validation
export const RateLimitValidators = {
  // Check if user has exceeded message rate limit
  checkMessageRateLimit: (userId: string, messageCount: number, windowMs: number): boolean => {
    // This would typically check against Redis or in-memory store
    const maxMessages = 30; // 30 messages per minute
    return messageCount < maxMessages;
  },

  // Check reaction rate limit
  checkReactionRateLimit: (userId: string, reactionCount: number): boolean => {
    const maxReactions = 60; // 60 reactions per minute
    return reactionCount < maxReactions;
  },

  // Check file upload rate limit
  checkUploadRateLimit: (userId: string, uploadSize: number, totalSize: number): boolean => {
    const maxSizePerMinute = 100 * 1024 * 1024; // 100MB per minute
    return totalSize + uploadSize <= maxSizePerMinute;
  }
};

// Validation middleware
export function createValidationMiddleware(eventName: string) {
  return (data: any, next: (error?: Error) => void) => {
    try {
      const validator = EventValidators[eventName];
      if (validator) {
        validator(data);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Bulk validation utility
export function validateBulkData<T>(
  items: unknown[],
  schema: z.ZodSchema<T>,
  maxItems = 100
): { valid: T[]; invalid: Array<{ index: number; error: string }> } {
  const valid: T[] = [];
  const invalid: Array<{ index: number; error: string }> = [];

  if (items.length > maxItems) {
    throw new ValidationError(
      `Too many items. Maximum allowed: ${maxItems}`,
      'items',
      'TOO_MANY_ITEMS'
    );
  }

  items.forEach((item, index) => {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({
        index,
        error: result.error.errors.map(e => e.message).join(', ')
      });
    }
  });

  return { valid, invalid };
}

// Export all validators and utilities
export default {
  ExtendedValidationSchemas,
  CustomValidators,
  SchemaBuilders,
  EventValidators,
  Sanitizers,
  RateLimitValidators,
  ValidationError,
  createValidationMiddleware,
  validateBulkData
};