import { z } from 'zod';

// Artifact version schema
export const ArtifactVersionSchema = z.object({
  id: z.string(),
  artifactId: z.string(),
  version: z.number(),
  title: z.string(),
  description: z.string().optional(),
  content: z.any(), // Versioned content
  metadata: z.record(z.any()).optional(),
  changes: z.array(z.object({
    type: z.enum(['added', 'modified', 'removed']),
    path: z.string(), // JSON path to the changed field
    oldValue: z.any().optional(),
    newValue: z.any().optional(),
    description: z.string().optional()
  })).default([]),
  createdAt: z.date(),
  createdBy: z.string(),
  parentVersion: z.number().optional(),
  branchName: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  size: z.number().optional(), // Size in bytes
  checksum: z.string().optional()
});

export type ArtifactVersion = z.infer<typeof ArtifactVersionSchema>;

// Version comparison result
export const VersionComparisonSchema = z.object({
  fromVersion: z.number(),
  toVersion: z.number(),
  differences: z.array(z.object({
    type: z.enum(['added', 'modified', 'removed']),
    path: z.string(),
    oldValue: z.any().optional(),
    newValue: z.any().optional(),
    similarity: z.number().min(0).max(1).optional() // For fuzzy comparisons
  })),
  summary: z.object({
    added: z.number(),
    modified: z.number(),
    removed: z.number(),
    similarity: z.number().min(0).max(1)
  }),
  metadata: z.object({
    comparedAt: z.date(),
    algorithm: z.string().default('json-diff'),
    options: z.record(z.any()).optional()
  })
});

export type VersionComparison = z.infer<typeof VersionComparisonSchema>;

// Version branch schema (for collaborative editing)
export const VersionBranchSchema = z.object({
  id: z.string(),
  artifactId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  baseVersion: z.number(),
  headVersion: z.number(),
  status: z.enum(['active', 'merged', 'closed']),
  createdAt: z.date(),
  createdBy: z.string(),
  mergedAt: z.date().optional(),
  mergedBy: z.string().optional(),
  mergeCommitId: z.string().optional(),
  conflicts: z.array(z.object({
    path: z.string(),
    type: z.enum(['content', 'metadata']),
    description: z.string(),
    resolved: z.boolean().default(false),
    resolvedBy: z.string().optional(),
    resolvedAt: z.date().optional()
  })).default([])
});

export type VersionBranch = z.infer<typeof VersionBranchSchema>;

// Merge request schema
export const MergeRequestSchema = z.object({
  id: z.string(),
  artifactId: z.string(),
  sourceBranch: z.string(),
  targetBranch: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['open', 'merged', 'closed', 'draft']),
  createdAt: z.date(),
  createdBy: z.string(),
  assignees: z.array(z.string()).default([]),
  reviewers: z.array(z.object({
    userId: z.string(),
    status: z.enum(['pending', 'approved', 'rejected']),
    comment: z.string().optional(),
    reviewedAt: z.date().optional()
  })).default([]),
  changes: z.array(z.object({
    type: z.enum(['added', 'modified', 'removed']),
    path: z.string(),
    oldValue: z.any().optional(),
    newValue: z.any().optional()
  })),
  conflicts: z.array(z.object({
    path: z.string(),
    type: z.string(),
    resolved: z.boolean().default(false)
  })).default([]),
  mergedAt: z.date().optional(),
  mergedBy: z.string().optional(),
  closedAt: z.date().optional(),
  closedBy: z.string().optional()
});

export type MergeRequest = z.infer<typeof MergeRequestSchema>;

// Version history query options
export const VersionHistoryOptionsSchema = z.object({
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
  since: z.date().optional(),
  until: z.date().optional(),
  branch: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  includeContent: z.boolean().default(false),
  includeMetadata: z.boolean().default(true)
});

export type VersionHistoryOptions = z.infer<typeof VersionHistoryOptionsSchema>;

// Rollback operation
export const RollbackOperationSchema = z.object({
  id: z.string(),
  artifactId: z.string(),
  fromVersion: z.number(),
  toVersion: z.number(),
  reason: z.string(),
  createdAt: z.date(),
  createdBy: z.string(),
  status: z.enum(['pending', 'completed', 'failed']),
  error: z.string().optional(),
  backupVersion: z.number().optional() // Version created as backup before rollback
});

export type RollbackOperation = z.infer<typeof RollbackOperationSchema>;

// Version analytics
export const VersionAnalyticsSchema = z.object({
  artifactId: z.string(),
  totalVersions: z.number(),
  totalSize: z.number(), // Total size across all versions
  averageSize: z.number(),
  versionFrequency: z.object({
    daily: z.number(),
    weekly: z.number(),
    monthly: z.number()
  }),
  contributors: z.array(z.object({
    userId: z.string(),
    versions: z.number(),
    firstContribution: z.date(),
    lastContribution: z.date()
  })),
  branches: z.object({
    total: z.number(),
    active: z.number(),
    merged: z.number(),
    closed: z.number()
  }),
  mergeRequests: z.object({
    total: z.number(),
    open: z.number(),
    merged: z.number(),
    closed: z.number(),
    averageReviewTime: z.number().optional() // in hours
  }),
  storage: z.object({
    totalSize: z.number(),
    compressedSize: z.number().optional(),
    compressionRatio: z.number().optional()
  })
});

export type VersionAnalytics = z.infer<typeof VersionAnalyticsSchema>;