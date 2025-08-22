import { z } from 'zod';

export const tenantIdSchema = z.string().uuid().brand('TenantId');
export const userIdSchema = z.string().uuid().brand('UserId');
export const workspaceIdSchema = z.string().uuid().brand('WorkspaceId');
export const conversationIdSchema = z.string().uuid().brand('ConversationId');
export const artifactIdSchema = z.string().uuid().brand('ArtifactId');

export const createMessageSchema = z.object({
  content: z.string().min(1).max(32768),
  attachments: z.array(z.string()).optional(),
  toolsAllowed: z.array(z.string()).optional(),
  artifactsExpected: z.array(z.string()).optional(),
  parentMessageId: z.string().uuid().optional(),
});

export const toolInvocationSchema = z.object({
  name: z.string(),
  parameters: z.record(z.unknown()),
  timeout: z.number().min(1).max(300).optional(),
  confirmationRequired: z.boolean().optional(),
});

export const createArtifactSchema = z.object({
  type: z.string(),
  name: z.string(),
  content: z.union([z.string(), z.record(z.unknown())]),
  metadata: z.record(z.unknown()).optional(),
  conversationId: conversationIdSchema.optional(),
  parentArtifactId: artifactIdSchema.optional(),
});

export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    traceId: z.string().optional(),
  }),
});