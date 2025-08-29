import type { z } from 'zod';
import type { TenantId, UserId } from '@penny/shared';

export interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  icon?: string;
  schema: z.ZodSchema<any>;
  handler: ToolHandler;
  config?: ToolConfig;
}

export type ToolCategory =
  | 'analytics'
  | 'productivity'
  | 'communication'
  | 'development'
  | 'data'
  | 'utility';

export interface ToolConfig {
  requiresAuth?: boolean;
  requiresConfirmation?: boolean;
  rateLimit?: {
    requests: number;
    window: number; // seconds
  };
  timeout?: number; // milliseconds
  maxRetries?: number;
  permissions?: string[];
  cost?: number; // internal cost units
}

export type ToolHandler = (params: any, context: ToolContext) => Promise<ToolResult>;

export interface ToolContext {
  tenantId: TenantId;
  userId: UserId;
  conversationId?: string;
  messageId?: string;
  auth?: ToolAuth;
  signal?: AbortSignal;
}

export interface ToolAuth {
  type: 'oauth2' | 'apikey' | 'basic' | 'custom';
  credentials: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: ToolError;
  artifacts?: ToolArtifact[];
  usage?: ToolUsage;
  metadata?: Record<string, any>;
}

export interface ToolError {
  code: string;
  message: string;
  details?: any;
  retryable?: boolean;
}

export interface ToolArtifact {
  type: string;
  name: string;
  content?: any;
  mimeType: string;
  size?: number;
  url?: string;
}

export interface ToolUsage {
  credits?: number;
  apiCalls?: number;
  duration?: number;
}

export interface ToolExecution {
  id: string;
  toolName: string;
  status: ToolExecutionStatus;
  params: any;
  result?: ToolResult;
  error?: ToolError;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  retries?: number;
}

export enum ToolExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public tool: string,
    public retryable = false,
    public details?: any,
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export interface ToolPermission {
  tool: string;
  action: 'execute' | 'configure' | 'view';
  scope?: 'own' | 'workspace' | 'tenant';
}
