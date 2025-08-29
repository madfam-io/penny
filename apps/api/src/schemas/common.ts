import { z } from 'zod';

// Common pagination schema
export const PaginationSchema = z.object({
  total: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0),
  hasMore: z.boolean().optional(),
});

// Common error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  code: z.string().optional(),
  timestamp: z.string().optional(),
});

// Common success response schema
export const SuccessResponseSchema = z.object({
  success: z.boolean().default(true),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

// Common filter/sort schemas
export const SortOrderSchema = z.enum(['asc', 'desc']);

export const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// Common metadata schema
export const MetadataSchema = z.record(z.unknown()).default({});

// Common ID parameter schema
export const IdParamSchema = z.object({
  id: z.string().min(1),
});

// Common query schemas
export const SearchQuerySchema = z.object({
  q: z.string().optional(),
  search: z.string().optional(),
});

export const TimestampQuerySchema = z.object({
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
});

// File upload schema
export const FileUploadSchema = z.object({
  filename: z.string(),
  mimetype: z.string(),
  size: z.number().int().positive(),
  data: z.instanceof(Buffer).optional(),
  url: z.string().url().optional(),
});

// Webhook event schema
export const WebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  tenantId: z.string(),
  userId: z.string().optional(),
});

// Usage metrics schema
export const UsageMetricSchema = z.object({
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
  timestamp: z.string().datetime(),
  metadata: MetadataSchema,
});

// Feature flag schema
export const FeatureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  conditions: z.record(z.unknown()).optional(),
});

// Tenant context schema (for request context)
export const TenantContextSchema = z.object({
  tenantId: z.string(),
  userId: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  subscriptionTier: z.string().optional(),
  limits: z.record(z.unknown()).optional(),
});

// API response wrapper
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean().default(true),
    data: dataSchema,
    pagination: PaginationSchema.optional(),
    meta: z.record(z.unknown()).optional(),
  });

// Bulk operation schemas
export const BulkOperationSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

export const BulkUpdateSchema = <T extends z.ZodTypeAny>(updateSchema: T) =>
  z.object({
    ids: z.array(z.string()).min(1).max(100),
    data: updateSchema,
  });

export const BulkResultSchema = z.object({
  successful: z.array(z.string()),
  failed: z.array(z.object({
    id: z.string(),
    error: z.string(),
  })),
  total: z.number().int(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
});

// Health check schema
export const HealthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  uptime: z.number(),
  version: z.string(),
  services: z.record(z.object({
    status: z.enum(['up', 'down', 'degraded']),
    latency: z.number().optional(),
    error: z.string().optional(),
  })),
});

// Rate limiting schema
export const RateLimitSchema = z.object({
  limit: z.number().int().positive(),
  remaining: z.number().int().min(0),
  reset: z.number().int().positive(),
  retryAfter: z.number().int().optional(),
});