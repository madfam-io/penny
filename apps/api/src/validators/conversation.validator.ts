import { z } from 'zod';

// Base schemas
export const ConversationIdSchema = z.string().min(1, 'Conversation ID is required');

export const ConversationMetadataSchema = z.record(z.unknown()).default({});

export const ConversationTitleSchema = z.string()
  .min(1, 'Title must not be empty')
  .max(255, 'Title must be 255 characters or less')
  .optional();

// Query parameter schemas
export const ConversationListQuerySchema = z.object({
  workspaceId: z.string().optional(),
  isArchived: z.boolean().optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  include: z.string()\n    .transform(val => val.split(',').map(s => s.trim()))
    .pipe(z.array(z.enum(['messages', 'artifacts', 'stats'])))
    .optional(),
});

export const ConversationDetailQuerySchema = z.object({
  include: z.string()\n    .transform(val => val.split(',').map(s => s.trim()))
    .pipe(z.array(z.enum(['messages', 'artifacts', 'memories', 'stats'])))
    .optional(),
  messagesLimit: z.coerce.number().int().positive().max(1000).default(50),
  artifactsLimit: z.coerce.number().int().positive().max(100).default(20),
});

export const ConversationSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().int().positive().max(100).default(20),
  includeArchived: z.boolean().default(false),
  workspaceId: z.string().optional(),
});

// Request body schemas
export const CreateConversationSchema = z.object({
  title: ConversationTitleSchema,
  workspaceId: z.string().optional(),
  metadata: ConversationMetadataSchema,
  initialMessage: z.string().max(50000).optional(),
});

export const UpdateConversationSchema = z.object({
  title: ConversationTitleSchema,
  metadata: ConversationMetadataSchema.optional(),
  isArchived: z.boolean().optional(),
});

export const ArchiveConversationSchema = z.object({
  isArchived: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const GenerateSummarySchema = z.object({
  maxLength: z.number().int().positive().max(1000).default(200),
  style: z.enum(['brief', 'detailed', 'technical']).default('brief'),
});

export const BulkConversationActionSchema = z.object({
  conversationIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['archive', 'unarchive', 'delete', 'export']),
  metadata: z.record(z.unknown()).optional(),
});

// Memory management schemas
export const StoreMemorySchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(10000),
  metadata: ConversationMetadataSchema,
  expiresAt: z.string().datetime().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const GetMemorySchema = z.object({
  key: z.string().min(1).max(100),
});

export const DeleteMemorySchema = z.object({
  key: z.string().min(1).max(100),
});

// Response schemas
export const ConversationResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  metadata: z.record(z.unknown()),
  isArchived: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number().optional(),
  lastMessage: z.object({
    id: z.string(),
    content: z.string(),
    role: z.string(),
    createdAt: z.string(),
  }).optional(),
  messages: z.array(z.object({
    id: z.string(),
    role: z.string(),
    content: z.string(),
    metadata: z.record(z.unknown()),
    tokenCount: z.number(),
    createdAt: z.string(),
  })).optional(),
  artifacts: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    createdAt: z.string(),
  })).optional(),
  memories: z.array(z.object({
    key: z.string(),
    value: z.string(),
    metadata: z.record(z.unknown()),
    createdAt: z.string(),
    expiresAt: z.string().nullable(),
  })).optional(),
  stats: z.object({
    messageCount: z.number(),
    totalTokens: z.number(),
    artifactCount: z.number(),
    participantCount: z.number(),
  }).optional(),
});

export const ConversationListResponseSchema = z.object({
  data: z.array(ConversationResponseSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
  filters: z.object({
    workspaceId: z.string().optional(),
    isArchived: z.boolean().optional(),
    search: z.string().optional(),
  }),
});

export const ConversationStatsResponseSchema = z.object({
  totalConversations: z.number(),
  activeConversations: z.number(),
  archivedConversations: z.number(),
  totalMessages: z.number(),
  totalTokens: z.number(),
  averageMessagesPerConversation: z.number(),
  averageTokensPerMessage: z.number(),
  topWorkspaces: z.array(z.object({
    workspaceId: z.string(),
    workspaceName: z.string(),
    conversationCount: z.number(),
  })),
  activityByDay: z.array(z.object({
    date: z.string(),
    conversations: z.number(),
    messages: z.number(),
  })),
});

// Validation helper functions
export function validateConversationId(id: unknown): string {
  return ConversationIdSchema.parse(id);
}

export function validateCreateConversation(data: unknown) {
  return CreateConversationSchema.parse(data);
}

export function validateUpdateConversation(data: unknown) {
  return UpdateConversationSchema.parse(data);
}

export function validateConversationQuery(query: unknown) {
  return ConversationListQuerySchema.parse(query);
}

export function validateMemoryOperation(data: unknown, operation: 'store' | 'get' | 'delete') {
  switch (operation) {
    case 'store':
      return StoreMemorySchema.parse(data);
    case 'get':
      return GetMemorySchema.parse(data);
    case 'delete':
      return DeleteMemorySchema.parse(data);
    default:
      throw new Error(`Invalid memory operation: ${operation}`);
  }
}

export function validateBulkAction(data: unknown) {
  return BulkConversationActionSchema.parse(data);
}

// Custom validation rules
export const ConversationValidationRules = {
  // Check if title is unique within workspace (optional constraint)
  isTitleUnique: z.string().refine(
    async (title, ctx) => {
      // This would need to be implemented with database access
      // For now, we'll skip async validation in the schema
      return true;
    },
    { message: 'Title must be unique within workspace' }
  ),

  // Validate metadata structure
  validateMetadata: z.record(z.unknown()).refine(
    (metadata) => {
      // Check metadata size
      const size = JSON.stringify(metadata).length;
      return size <= 10000; // 10KB limit
    },
    { message: 'Metadata must be less than 10KB' }
  ).refine(
    (metadata) => {
      // Check for reserved keys\n      const reservedKeys = ['__internal', '__system', '__temp'];
      return !Object.keys(metadata).some(key => reservedKeys.includes(key));
    },
    { message: 'Metadata cannot contain reserved keys' }
  ),

  // Validate workspace access
  validateWorkspaceAccess: z.string().refine(
    async (workspaceId, ctx) => {
      // This would need to be implemented with database access
      // Check if user has access to the workspace
      return true;
    },
    { message: 'Access denied to workspace' }
  ),
};

// Error messages
export const ConversationValidationErrors = {
  CONVERSATION_NOT_FOUND: 'Conversation not found',
  INVALID_CONVERSATION_ID: 'Invalid conversation ID format',
  TITLE_TOO_LONG: 'Conversation title is too long',
  TITLE_REQUIRED: 'Conversation title is required',
  METADATA_TOO_LARGE: 'Conversation metadata exceeds size limit',
  INVALID_METADATA: 'Invalid metadata format',
  WORKSPACE_ACCESS_DENIED: 'Access denied to workspace',
  CONVERSATION_ARCHIVED: 'Cannot modify archived conversation',
  BULK_ACTION_LIMIT_EXCEEDED: 'Too many conversations in bulk action',
  MEMORY_KEY_INVALID: 'Invalid memory key format',
  MEMORY_VALUE_TOO_LARGE: 'Memory value exceeds size limit',
  SEARCH_QUERY_TOO_SHORT: 'Search query must be at least 1 character',
  INVALID_SORT_FIELD: 'Invalid sort field',
  PAGINATION_LIMIT_EXCEEDED: 'Pagination limit exceeded',
} as const;

// Type exports
export type ConversationListQuery = z.infer<typeof ConversationListQuerySchema>;
export type CreateConversationData = z.infer<typeof CreateConversationSchema>;
export type UpdateConversationData = z.infer<typeof UpdateConversationSchema>;
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;
export type ConversationStats = z.infer<typeof ConversationStatsResponseSchema>;
export type StoreMemoryData = z.infer<typeof StoreMemorySchema>;
export type BulkConversationAction = z.infer<typeof BulkConversationActionSchema>;