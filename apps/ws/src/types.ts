import { Socket } from 'socket.io';
import { z } from 'zod';

// User interface from JWT token
export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

// Extended Socket interface with authentication
export interface AuthenticatedSocket extends Socket {
  user?: User;
  conversations?: Set<string>;
  rooms?: Set<string>;
  isAuthenticated: boolean;
  rateLimitInfo?: {
    points: number;
    totalHits: number;
    msBeforeNext: number;
  };
}

// Presence status enum
export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

// Message types
export enum MessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  TOOL_CALL = 'tool_call',
  TOOL_RESULT = 'tool_result',
  ERROR = 'error'
}

// WebSocket event types
export enum SocketEvent {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTHENTICATED = 'authenticated',
  AUTHENTICATION_ERROR = 'authentication_error',
  
  // Room events
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  ROOM_JOINED = 'room_joined',
  ROOM_LEFT = 'room_left',
  
  // Conversation events
  JOIN_CONVERSATION = 'join_conversation',
  LEAVE_CONVERSATION = 'leave_conversation',
  CONVERSATION_JOINED = 'conversation_joined',
  CONVERSATION_LEFT = 'conversation_left',
  CONVERSATION_MESSAGES = 'conversation_messages',
  
  // Message events
  SEND_MESSAGE = 'send_message',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_CREATED = 'message_created',
  MESSAGE_UPDATED = 'message_updated',
  MESSAGE_DELETED = 'message_deleted',
  MESSAGE_REACTION = 'message_reaction',
  
  // Streaming events
  STREAM_START = 'stream_start',
  STREAM_CHUNK = 'stream_chunk',
  STREAM_COMPLETE = 'stream_complete',
  STREAM_ERROR = 'stream_error',
  STREAM_COMPLETION = 'stream_completion',
  
  // Typing events
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  
  // Presence events
  PRESENCE_UPDATE = 'presence_update',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  USER_PRESENCE_CHANGED = 'user_presence_changed',
  
  // Collaboration events
  CURSOR_UPDATE = 'cursor_update',
  SELECTION_UPDATE = 'selection_update',
  COLLABORATIVE_EDIT = 'collaborative_edit',
  
  // Notification events
  NOTIFICATION = 'notification',
  NOTIFICATION_READ = 'notification_read',
  NOTIFICATION_DELIVERED = 'notification_delivered',
  
  // Error events
  ERROR = 'error',
  RATE_LIMITED = 'rate_limited',
  
  // Health events
  HEARTBEAT = 'heartbeat',
  PONG = 'pong'
}

// Room types
export enum RoomType {
  CONVERSATION = 'conversation',
  TENANT = 'tenant',
  USER = 'user',
  ADMIN = 'admin',
  NOTIFICATION = 'notification'
}

// Validation schemas
export const JoinRoomSchema = z.object({
  roomId: z.string(),
  roomType: z.nativeEnum(RoomType),
  metadata: z.record(z.unknown()).optional()
});

export const JoinConversationSchema = z.object({
  conversationId: z.string(),
  tenantId: z.string(),
  userId: z.string()
});

export const SendMessageSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1).max(50000),
  role: z.enum(['user', 'assistant', 'system']).default('user'),
  parentMessageId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    size: z.number(),
    url: z.string()
  })).optional()
});

export const StreamCompletionSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1).max(50000),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32000).optional(),
  toolsEnabled: z.array(z.string()).optional(),
  artifactsEnabled: z.boolean().default(false),
  systemPrompt: z.string().optional()
});

export const TypingSchema = z.object({
  conversationId: z.string(),
  isTyping: z.boolean()
});

export const PresenceUpdateSchema = z.object({
  status: z.nativeEnum(PresenceStatus),
  lastActive: z.date().optional(),
  customMessage: z.string().max(100).optional()
});

export const MessageReactionSchema = z.object({
  messageId: z.string(),
  reaction: z.string().emoji('Invalid emoji'),
  action: z.enum(['add', 'remove'])
});

export const CursorUpdateSchema = z.object({
  conversationId: z.string(),
  position: z.object({
    line: z.number().int().nonnegative(),
    column: z.number().int().nonnegative()
  }),
  selection: z.object({
    start: z.object({
      line: z.number().int().nonnegative(),
      column: z.number().int().nonnegative()
    }),
    end: z.object({
      line: z.number().int().nonnegative(),
      column: z.number().int().nonnegative()
    })
  }).optional()
});

export const NotificationSchema = z.object({
  id: z.string(),
  type: z.enum(['message', 'mention', 'system', 'tool_result']),
  title: z.string(),
  body: z.string(),
  data: z.record(z.unknown()).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  expiresAt: z.date().optional()
});

// Type definitions from schemas
export type JoinRoomData = z.infer<typeof JoinRoomSchema>;
export type JoinConversationData = z.infer<typeof JoinConversationSchema>;
export type SendMessageData = z.infer<typeof SendMessageSchema>;
export type StreamCompletionData = z.infer<typeof StreamCompletionSchema>;
export type TypingData = z.infer<typeof TypingSchema>;
export type PresenceUpdateData = z.infer<typeof PresenceUpdateSchema>;
export type MessageReactionData = z.infer<typeof MessageReactionSchema>;
export type CursorUpdateData = z.infer<typeof CursorUpdateSchema>;
export type NotificationData = z.infer<typeof NotificationSchema>;

// Room naming interfaces
export interface Room {
  id: string;
  type: RoomType;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  participants: Set<string>;
  createdAt: Date;
  lastActivity: Date;
}

// Presence tracking interface
export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastActive: Date;
  customMessage?: string;
  socketIds: Set<string>;
  conversationIds: Set<string>;
}

// Typing indicator interface
export interface TypingIndicator {
  userId: string;
  userName: string;
  conversationId: string;
  startedAt: Date;
  timeout: NodeJS.Timeout;
}

// Message interface
export interface Message {
  id: string;
  conversationId: string;
  userId: string | null;
  content: string;
  role: 'user' | 'assistant' | 'system';
  type: MessageType;
  parentMessageId?: string;
  metadata: Record<string, unknown>;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  createdAt: Date;
  updatedAt: Date;
}

// Attachment interface
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  metadata?: Record<string, unknown>;
}

// Tool call interface
export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'executing' | 'completed' | 'error';
  executedAt?: Date;
}

// Stream chunk types
export type StreamChunk = 
  | { type: 'content'; content: string; }
  | { type: 'tool_call'; toolCall: ToolCall; }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; }
  | { type: 'tool_execution_complete'; toolCallId: string; result: unknown; }
  | { type: 'error'; error: string; }
  | { type: 'done'; };

// Error types
export interface SocketError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// Rate limiting interface
export interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration?: number;
  execEvenly?: boolean;
}

// Redis pub/sub message types
export interface PubSubMessage {
  type: 'room_event' | 'user_event' | 'broadcast';
  event: string;
  data: unknown;
  targetId?: string; // roomId or userId
  senderId?: string;
  timestamp: Date;
}

// Health check interface
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    redis: 'connected' | 'disconnected' | 'error';
    database: 'connected' | 'disconnected' | 'error';
  };
  metrics: {
    activeConnections: number;
    totalRooms: number;
    messagesSentPerMinute: number;
    averageResponseTime: number;
  };
}

// Configuration interfaces
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  lazyConnect?: boolean;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  redis: RedisConfig;
  jwt: {
    secret: string;
    audience?: string;
    issuer?: string;
  };
  rateLimit: {
    global: RateLimitConfig;
    perSocket: RateLimitConfig;
    perRoom: RateLimitConfig;
  };
  heartbeat: {
    interval: number;
    timeout: number;
  };
}