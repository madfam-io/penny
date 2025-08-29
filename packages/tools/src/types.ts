import type { z } from 'zod';
import type { TenantId, UserId } from '@penny/shared';
import type { JSONSchema7 } from 'json-schema';

// Enhanced Tool Definition with JSON Schema support
export interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  version: string;
  icon?: string;
  tags?: string[];
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  
  // Schema definitions (both Zod and JSON Schema)
  schema: z.ZodSchema<any>;
  jsonSchema?: JSONSchema7;
  
  // Handler function
  handler: ToolHandler;
  
  // Configuration
  config?: ToolConfig;
  
  // Dependencies
  dependencies?: ToolDependency[];
  
  // Metadata
  metadata?: ToolMetadata;
  
  // Custom properties
  [key: string]: any;
}

export type ToolCategory = 
  | 'analytics'
  | 'productivity' 
  | 'communication'
  | 'development'
  | 'data'
  | 'utility'
  | 'integration'
  | 'visualization'
  | 'automation'
  | 'custom';

export interface ToolConfig {
  // Authentication & Authorization
  requiresAuth?: boolean;
  requiresConfirmation?: boolean;
  permissions?: string[];
  scopes?: string[];
  
  // Execution limits
  rateLimit?: ToolRateLimit;
  timeout?: number; // milliseconds
  maxRetries?: number;
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  
  // Sandbox settings
  requiresSandbox?: boolean;
  allowNetworkAccess?: boolean;
  allowFileSystem?: boolean;
  allowedHosts?: string[];
  
  // Cost & billing
  cost?: number; // internal cost units
  creditsPerExecution?: number;
  
  // UI settings
  showInMarketplace?: boolean;
  featured?: boolean;
  deprecated?: boolean;
  
  // Caching
  cacheable?: boolean;
  cacheTTL?: number;
  
  // Error handling
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
  
  // Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logSensitiveData?: boolean;
  
  // Custom configuration
  [key: string]: any;
}

export interface ToolRateLimit {
  requests: number;
  window: number; // seconds
  burst?: number; // allow burst requests
  skipSuccessful?: boolean; // only count failed requests
}

export interface ToolDependency {
  name: string;
  version?: string;
  type: 'tool' | 'service' | 'library' | 'model';
  optional?: boolean;
  description?: string;
}

export interface ToolMetadata {
  createdAt?: Date;
  updatedAt?: Date;
  lastUsed?: Date;
  usageCount?: number;
  averageExecutionTime?: number;
  successRate?: number;
  userRating?: number;
  totalRatings?: number;
  downloadCount?: number;
  
  // Documentation
  examples?: ToolExample[];
  changelog?: ToolChangelogEntry[];
  troubleshooting?: ToolTroubleshooting[];
  
  // Custom metadata
  [key: string]: any;
}

export interface ToolExample {
  title: string;
  description?: string;
  parameters: Record<string, any>;
  expectedOutput?: any;
  code?: string;
}

export interface ToolChangelogEntry {
  version: string;
  date: Date;
  changes: string[];
  breaking?: boolean;
}

export interface ToolTroubleshooting {
  issue: string;
  solution: string;
  category?: 'common' | 'configuration' | 'permissions' | 'performance';
}

// Tool Handler Types
export type ToolHandler = (params: any, context: ToolContext) => Promise<ToolResult>;

export interface ToolContext {
  tenantId: TenantId;
  userId: UserId;
  conversationId?: string;
  messageId?: string;
  executionId: string;
  
  // Authentication & authorization
  auth?: ToolAuth;
  permissions?: string[];
  
  // Request context
  signal?: AbortSignal;
  headers?: Record<string, string>;
  userAgent?: string;
  ipAddress?: string;
  
  // Execution context  
  sandbox?: boolean;
  dryRun?: boolean;
  
  // Tool chain context
  chainId?: string;
  previousResults?: ToolResult[];
  
  // Custom context
  [key: string]: any;
}

export interface ToolAuth {
  type: 'oauth2' | 'apikey' | 'basic' | 'bearer' | 'custom';
  credentials: Record<string, any>;
  scopes?: string[];
  expiresAt?: Date;
}

// Tool Result Types
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: ToolError;
  artifacts?: ToolArtifact[];
  usage?: ToolUsage;
  metadata?: ToolResultMetadata;
  
  // Execution metrics
  duration?: number;
  memoryUsed?: number;
  cpuTime?: number;
  
  // Chaining support
  chainable?: boolean;
  nextTools?: string[];
  
  // Custom result data
  [key: string]: any;
}

export interface ToolResultMetadata {
  cached?: boolean;
  retries?: number;
  executionId?: string;
  timestamp?: Date;
  version?: string;
  source?: string;
  confidence?: number;
  warnings?: string[];
  
  // Custom metadata
  [key: string]: any;
}

export interface ToolError {
  code: string;
  message: string;
  details?: any;
  retryable?: boolean;
  category?: 'validation' | 'auth' | 'network' | 'timeout' | 'rate_limit' | 'internal' | 'external';
  suggestions?: string[];
  documentationUrl?: string;
  
  // Error chain
  cause?: ToolError;
  stack?: string;
}

export interface ToolArtifact {
  type: string;
  name: string;
  content?: any;
  mimeType: string;
  size?: number;
  url?: string;
  preview?: string;
  downloadable?: boolean;
  shareable?: boolean;
  
  // Metadata
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    createdAt?: Date;
    tags?: string[];
    [key: string]: any;
  };
}

export interface ToolUsage {
  credits?: number;
  apiCalls?: number;
  duration?: number;
  bytesTransferred?: number;
  computeUnits?: number;
  memorySeconds?: number;
  
  // Billing
  cost?: {
    amount: number;
    currency: string;
    breakdown?: Record<string, number>;
  };
  
  // Custom usage metrics
  [key: string]: any;
}

// Tool Execution Types
export interface ToolExecution {
  id: string;
  toolName: string;
  version?: string;
  status: ToolExecutionStatus;
  params: any;
  result?: ToolResult;
  error?: ToolError;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  
  // Retry tracking
  retries?: number;
  maxRetries?: number;
  
  // Context
  context?: ToolContext;
  
  // Priority and queuing
  priority?: number;
  queuedAt?: Date;
  
  // Monitoring
  logs?: ToolLogEntry[];
  metrics?: Record<string, number>;
  
  // Cancellation
  cancelledBy?: string;
  cancelReason?: string;
  
  // Custom execution data
  [key: string]: any;
}

export enum ToolExecutionStatus {
  QUEUED = 'queued',
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  RETRYING = 'retrying',
}

export interface ToolLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  source?: string;
}

// Tool Registry Types
export interface ToolRegistryConfig {
  // Storage
  cacheEnabled?: boolean;
  cacheTTL?: number;
  
  // Validation
  strictValidation?: boolean;
  allowDuplicates?: boolean;
  
  // Security
  signatureValidation?: boolean;
  allowedSources?: string[];
  
  // Performance
  lazyLoading?: boolean;
  preloadTools?: string[];
  
  // Custom configuration
  [key: string]: any;
}

export interface ToolFilter {
  category?: ToolCategory | ToolCategory[];
  tags?: string | string[];
  author?: string;
  version?: string;
  permissions?: string[];
  featured?: boolean;
  deprecated?: boolean;
  search?: string;
  
  // Custom filters
  [key: string]: any;
}

export interface ToolSearchOptions {
  query?: string;
  filters?: ToolFilter;
  sortBy?: 'name' | 'category' | 'rating' | 'usage' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
  
  // Custom search options
  [key: string]: any;
}

export interface ToolSearchResult {
  tools: ToolDefinition[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  facets?: Record<string, Record<string, number>>;
}

// Tool Marketplace Types
export interface ToolPackage {
  id: string;
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  
  // Package metadata
  publishedAt: Date;
  updatedAt: Date;
  downloadCount: number;
  rating: number;
  ratingCount: number;
  
  // Tools in package
  tools: ToolDefinition[];
  
  // Dependencies
  dependencies?: ToolDependency[];
  
  // Installation
  installCommand?: string;
  configRequired?: boolean;
  
  // Security
  verified?: boolean;
  signature?: string;
  
  // Custom package data
  [key: string]: any;
}

export interface ToolInstallOptions {
  version?: string;
  force?: boolean;
  dependencies?: boolean;
  config?: Record<string, any>;
  
  // Custom install options
  [key: string]: any;
}

// Error Classes
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public tool: string,
    public retryable = false,
    public details?: any,
    public category?: ToolError['category']
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export class ToolValidationError extends Error {
  constructor(
    message: string,
    public tool: string,
    public errors: any[],
    public field?: string
  ) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

export class ToolRegistrationError extends Error {
  constructor(
    message: string,
    public tool: string,
    public reason: string
  ) {
    super(message);
    this.name = 'ToolRegistrationError';
  }
}

export class ToolNotFoundError extends Error {
  constructor(
    public tool: string,
    message = `Tool ${tool} not found`
  ) {
    super(message);
    this.name = 'ToolNotFoundError';
  }
}

export class ToolPermissionError extends Error {
  constructor(
    message: string,
    public tool: string,
    public permission: string,
    public userId?: string
  ) {
    super(message);
    this.name = 'ToolPermissionError';
  }
}

// Utility Types
export type ToolEvent = 
  | 'tool:registered'
  | 'tool:unregistered'
  | 'tool:updated'
  | 'execution:queued'
  | 'execution:started'
  | 'execution:running'
  | 'execution:completed'
  | 'execution:failed'
  | 'execution:cancelled'
  | 'execution:timeout'
  | 'execution:retrying';

export interface ToolEventPayload {
  tool?: string;
  execution?: ToolExecution;
  error?: ToolError;
  timestamp: Date;
  
  // Custom event data
  [key: string]: any;
}

export type ToolEventHandler = (event: ToolEvent, payload: ToolEventPayload) => void | Promise<void>;

// Permission Types
export interface ToolPermission {
  tool: string;
  action: 'execute' | 'configure' | 'view' | 'install' | 'uninstall' | 'publish';
  scope?: 'own' | 'workspace' | 'tenant' | 'global';
  conditions?: ToolPermissionCondition[];
}

export interface ToolPermissionCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: any;
}

// Analytics Types
export interface ToolAnalytics {
  tool: string;
  tenant?: TenantId;
  user?: UserId;
  
  // Usage metrics
  executionCount: number;
  successCount: number;
  failureCount: number;
  
  // Performance metrics
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  
  // Error analysis
  topErrors: Array<{
    code: string;
    count: number;
    percentage: number;
  }>;
  
  // Time series data
  timeline: Array<{
    timestamp: Date;
    count: number;
    avgDuration: number;
    errorRate: number;
  }>;
  
  // Resource usage
  avgMemoryUsage?: number;
  avgCpuUsage?: number;
  totalCreditsUsed?: number;
  
  // Custom analytics
  [key: string]: any;
}