/**
 * Type definitions for the Sandbox Client SDK
 */

// Core execution types
export interface CodeExecutionOptions {
  timeout?: number;
  maxMemory?: number;
  maxCpu?: number;
  allowNetworking?: boolean;
  packages?: string[];
  variables?: Record<string, any>;
}

export interface ExecutionMetrics {
  executionTime: number;
  memoryUsage: number;
  memoryPeak?: number;
  cpuUsage: number;
  cpuTime?: number;
  networkIO?: {
    bytesIn: number;
    bytesOut: number;
  };
  diskIO?: {
    bytesRead: number;
    bytesWritten: number;
  };
}

export interface ExecutionError {
  type: string;
  message: string;
  traceback: string;
  line?: number;
  column?: number;
  filename?: string;
}

// Variable types
export interface NumPyArrayData extends VariableData {
  type: 'numpy.ndarray';
  dtype: string;
  shape: number[];
  size: number;
  statistics?: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
}

export interface PandasDataFrameData extends VariableData {
  type: 'pandas.DataFrame';
  shape: [number, number]; // [rows, columns]
  columns: string[];
  dtypes: Record<string, string>;
  index?: any[];
  head?: Record<string, any>[];
  tail?: Record<string, any>[];
  describe?: Record<string, any>;
}

export interface PandasSeriesData extends VariableData {
  type: 'pandas.Series';
  name?: string;
  dtype: string;
  length: number;
  index?: any[];
  head?: any[];
  tail?: any[];
  describe?: Record<string, any>;
}

// Plot types
export interface PlotMetadata {
  width: number;
  height: number;
  dpi?: number;
  title?: string;
  xlabel?: string;
  ylabel?: string;
  legend?: boolean;
  figsize?: [number, number];
  backend?: string;
}

export interface MatplotlibPlot extends PlotData {
  format: 'png' | 'svg';
  metadata: PlotMetadata;
}

export interface PlotlyPlot extends PlotData {
  format: 'html';
  metadata: PlotMetadata & {
    interactive: boolean;
  };
}

// Session management types
export interface SessionOptions {
  metadata?: Record<string, any>;
  initialPackages?: string[];
  initialVariables?: Record<string, any>;
  timeout?: number;
}

export interface SessionStatistics {
  executionCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  memoryUsage: {
    current: number;
    peak: number;
    average: number;
  };
  cpuUsage: {
    current: number;
    average: number;
  };
  variableCount: number;
  packageCount: number;
}

// Package management types
export interface PackageCategory {
  id: string;
  name: string;
  description: string;
  packages: string[];
}

export interface PackageDependency {
  name: string;
  version: string;
  optional: boolean;
  extras?: string[];
}

export interface PackageInstallOptions {
  force?: boolean;
  upgrade?: boolean;
  noDeps?: boolean;
  index?: string;
  timeout?: number;
}

export interface PackageInstallResult {
  package: string;
  success: boolean;
  version?: string;
  error?: string;
  logs?: string[];
  duration?: number;
}

// Validation types
export interface CodeComplexity {
  cyclomaticComplexity: number;
  linesOfCode: number;
  logicalLinesOfCode: number;
  maintainabilityIndex: number;
  halsteadMetrics?: {
    vocabulary: number;
    length: number;
    difficulty: number;
    effort: number;
    time: number;
    bugs: number;
  };
}

export interface SecurityViolation {
  type: 'import' | 'function' | 'pattern' | 'keyword';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface CodeStyle {
  issues: StyleIssue[];
  score: number;
  maxScore: number;
}

export interface StyleIssue {
  type: 'naming' | 'spacing' | 'indentation' | 'line-length' | 'complexity';
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column?: number;
  fixable: boolean;
}

// Streaming types
export interface StreamOptions {
  includeStdout?: boolean;
  includeStderr?: boolean;
  includePlots?: boolean;
  includeVariables?: boolean;
  bufferSize?: number;
}

export interface StreamBuffer {
  stdout: string[];
  stderr: string[];
  plots: PlotData[];
  variables: Record<string, VariableData>;
}

// Error types
export class SandboxError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: any;

  constructor(message: string, code: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'SandboxError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ExecutionTimeoutError extends SandboxError {
  constructor(timeout: number) {
    super(
      `Code execution timed out after ${timeout}ms`,
      'EXECUTION_TIMEOUT',
      408
    );
  }
}

export class SecurityViolationError extends SandboxError {
  public readonly violations: SecurityViolation[];

  constructor(violations: SecurityViolation[]) {
    super(
      `Security violations detected: ${violations.map(v => v.description).join(', ')}`,
      'SECURITY_VIOLATION',
      400,
      violations
    );
    this.violations = violations;
  }
}

export class ResourceLimitError extends SandboxError {
  public readonly resource: string;
  public readonly limit: number;
  public readonly usage: number;

  constructor(resource: string, limit: number, usage: number) {
    super(
      `Resource limit exceeded: ${resource} usage (${usage}) exceeded limit (${limit})`,
      'RESOURCE_LIMIT_EXCEEDED',
      429,
      { resource, limit, usage }
    );
    this.resource = resource;
    this.limit = limit;
    this.usage = usage;
  }
}

// Configuration types
export interface SandboxClientConfig extends SandboxConfig {
  // Connection settings
  maxConcurrentRequests?: number;
  requestPoolSize?: number;
  keepAlive?: boolean;
  
  // Retry settings
  exponentialBackoff?: boolean;
  maxRetryDelay?: number;
  retryOnStatus?: number[];
  
  // Logging settings
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Default execution settings
  defaultTimeout?: number;
  defaultMaxMemory?: number;
  defaultMaxCpu?: number;
  
  // Feature flags
  enableStreaming?: boolean;
  enableMetrics?: boolean;
  enableCaching?: boolean;
}

// Utility types
export type SandboxEventType = 
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'session_created'
  | 'session_destroyed'
  | 'package_installed'
  | 'package_uninstalled'
  | 'security_violation'
  | 'resource_limit_exceeded';

export interface SandboxEvent {
  type: SandboxEventType;
  timestamp: string;
  sessionId?: string;
  executionId?: string;
  data: any;
}

export type EventCallback<T = any> = (event: SandboxEvent & { data: T }) => void;

// Type guards
export function isNumPyArrayData(data: VariableData): data is NumPyArrayData {
  return data.type === 'numpy.ndarray';
}

export function isPandasDataFrameData(data: VariableData): data is PandasDataFrameData {
  return data.type === 'pandas.DataFrame';
}

export function isPandasSeriesData(data: VariableData): data is PandasSeriesData {
  return data.type === 'pandas.Series';
}

export function isMatplotlibPlot(plot: PlotData): plot is MatplotlibPlot {
  return plot.format === 'png' || plot.format === 'svg';
}

export function isPlotlyPlot(plot: PlotData): plot is PlotlyPlot {
  return plot.format === 'html';
}

// Constants
export const SUPPORTED_PYTHON_VERSIONS = ['3.11'] as const;
export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_MAX_MEMORY = 512 * 1024 * 1024; // 512MB
export const DEFAULT_MAX_CPU = 50; // 50%
export const MAX_VARIABLE_SIZE = 1024 * 1024; // 1MB
export const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_PLOT_SIZE = 5 * 1024 * 1024; // 5MB

export type SupportedPythonVersion = typeof SUPPORTED_PYTHON_VERSIONS[number];