import { z } from 'zod';

// Base schemas
export const MessageIdSchema = z.string().min(1, 'Message ID is required');

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);

export const MessageContentSchema = z.string()
  .min(1, 'Message content is required')
  .max(50000, 'Message content must be 50,000 characters or less');

export const MessageMetadataSchema = z.record(z.unknown()).default({});

// Tool call schema
export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.string().default('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string(), // JSON string
  }),
});

// Query schemas
export const MessageListQuerySchema = z.object({
  role: MessageRoleSchema.optional(),
  parentMessageId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  before: z.string().optional(), // cursor-based pagination
  after: z.string().optional(),
  search: z.string().min(1).optional(),
  include: z.string()\n    .transform(val => val.split(',').map(s => s.trim()))
    .pipe(z.array(z.enum(['replies', 'artifacts', 'toolCalls'])))
    .optional(),
});

// Request body schemas
export const CreateMessageSchema = z.object({
  content: MessageContentSchema,
  role: MessageRoleSchema.default('user'),
  parentMessageId: z.string().optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
  metadata: MessageMetadataSchema,
  attachments: z.array(z.object({
    type: z.enum(['image', 'document', 'audio']),
    url: z.string().url(),
    filename: z.string(),
    size: z.number().positive(),
    mimeType: z.string(),
  })).optional(),
});

export const UpdateMessageSchema = z.object({
  content: MessageContentSchema,
  metadata: MessageMetadataSchema.optional(),
});

export const StreamMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: MessageContentSchema,
  toolsAllowed: z.array(z.string()).optional(),
  artifactsExpected: z.array(z.string()).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32000).optional(),
  metadata: MessageMetadataSchema,
  parentMessageId: z.string().optional(),
  stream: z.boolean().default(true),
});

export const RegenerateResponseSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32000).optional(),
  preserveToolCalls: z.boolean().default(false),
});

export const MessageSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  conversationId: z.string().optional(),
  role: MessageRoleSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  includeContext: z.boolean().default(false),
});

// Response schemas
export const MessageResponseSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  userId: z.string().nullable(),
  role: z.string(),
  content: z.string(),
  metadata: z.record(z.unknown()),
  parentMessageId: z.string().nullable(),
  toolCalls: z.array(ToolCallSchema).nullable(),
  tokenCount: z.number(),
  createdAt: z.string(),
  replies: z.array(z.object({
    id: z.string(),
    content: z.string().optional(),
    role: z.string(),
    createdAt: z.string(),
  })).optional(),
  artifacts: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    url: z.string().optional(),
  })).optional(),
  attachments: z.array(z.object({
    id: z.string(),
    type: z.string(),
    url: z.string(),
    filename: z.string(),
    size: z.number(),
  })).optional(),
});

export const MessageListResponseSchema = z.object({
  data: z.array(MessageResponseSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
    prevCursor: z.string().optional(),
  }),
});

// Stream event schemas
export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('content'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('tool_call'),
    toolCall: ToolCallSchema,
  }),
  z.object({
    type: z.literal('tool_execution_start'),
    toolCallId: z.string(),
    toolName: z.string(),
  }),
  z.object({
    type: z.literal('tool_execution_complete'),
    toolCallId: z.string(),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal('tool_execution_error'),
    toolCallId: z.string(),
    error: z.string(),
  }),
  z.object({
    type: z.literal('artifact_created'),
    artifactId: z.string(),
    artifactType: z.string(),
  }),
  z.object({
    type: z.literal('done'),
    messageId: z.string(),
    tokenUsage: z.object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    }).optional(),
  }),
  z.object({
    type: z.literal('error'),
    error: z.string(),
    code: z.string().optional(),
  }),
]);

// Validation functions
export function validateMessageId(id: unknown): string {
  return MessageIdSchema.parse(id);
}

export function validateCreateMessage(data: unknown) {
  return CreateMessageSchema.parse(data);
}

export function validateUpdateMessage(data: unknown) {
  return UpdateMessageSchema.parse(data);
}

export function validateStreamMessage(data: unknown) {
  return StreamMessageSchema.parse(data);
}

export function validateMessageQuery(query: unknown) {
  return MessageListQuerySchema.parse(query);
}

export function validateRegenerateRequest(data: unknown) {
  return RegenerateResponseSchema.parse(data);
}

export function validateMessageSearch(query: unknown) {
  return MessageSearchSchema.parse(query);
}

// Custom validation rules
export const MessageValidationRules = {
  // Validate content is not just whitespace
  hasRealContent: z.string().refine(
    (content) => content.trim().length > 0,
    { message: 'Message content cannot be empty or only whitespace' }
  ),

  // Validate tool calls are properly formatted
  validateToolCalls: z.array(ToolCallSchema).refine(
    (toolCalls) => {
      return toolCalls.every(tc => {
        try {
          JSON.parse(tc.function.arguments);
          return true;
        } catch {
          return false;
        }
      });
    },
    { message: 'Tool call arguments must be valid JSON' }
  ),

  // Validate attachment file sizes
  validateAttachments: z.array(z.object({
    type: z.enum(['image', 'document', 'audio']),
    size: z.number(),
    mimeType: z.string(),
  })).refine(
    (attachments) => {
      const maxSizes = {
        image: 10 * 1024 * 1024, // 10MB
        document: 50 * 1024 * 1024, // 50MB
        audio: 25 * 1024 * 1024, // 25MB
      };
      
      return attachments.every(att => att.size <= maxSizes[att.type]);
    },
    { message: 'Attachment exceeds maximum file size' }
  ),

  // Validate message thread depth
  validateThreadDepth: z.string().refine(
    async (parentMessageId, ctx) => {
      // This would need database access to check thread depth
      // For now, skip async validation
      return true;
    },
    { message: 'Message thread depth limit exceeded' }
  ),
};

// Error messages
export const MessageValidationErrors = {
  MESSAGE_NOT_FOUND: 'Message not found',
  INVALID_MESSAGE_ID: 'Invalid message ID format',
  CONTENT_REQUIRED: 'Message content is required',
  CONTENT_TOO_LONG: 'Message content exceeds maximum length',
  INVALID_ROLE: 'Invalid message role',
  INVALID_TOOL_CALLS: 'Invalid tool call format',
  METADATA_TOO_LARGE: 'Message metadata exceeds size limit',
  ATTACHMENT_TOO_LARGE: 'Attachment exceeds maximum file size',
  THREAD_DEPTH_EXCEEDED: 'Message thread depth limit exceeded',
  CONVERSATION_NOT_FOUND: 'Conversation not found',
  UNAUTHORIZED_EDIT: 'Cannot edit messages from other users',
  SYSTEM_MESSAGE_EDIT: 'Cannot edit system messages',
  REGENERATE_USER_MESSAGE: 'Cannot regenerate user messages',
  STREAMING_IN_PROGRESS: 'Cannot modify message while streaming',
  INVALID_SEARCH_QUERY: 'Invalid search query format',
  PAGINATION_LIMIT_EXCEEDED: 'Pagination limit exceeded',
} as const;

// Type exports
export type MessageListQuery = z.infer<typeof MessageListQuerySchema>;
export type CreateMessageData = z.infer<typeof CreateMessageSchema>;
export type UpdateMessageData = z.infer<typeof UpdateMessageSchema>;
export type StreamMessageData = z.infer<typeof StreamMessageSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type RegenerateRequest = z.infer<typeof RegenerateResponseSchema>;