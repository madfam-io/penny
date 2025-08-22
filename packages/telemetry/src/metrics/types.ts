export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  unit?: MetricUnit;
}

export type MetricUnit = 
  | 'count'
  | 'bytes'
  | 'milliseconds'
  | 'seconds'
  | 'percent'
  | 'requests'
  | 'errors'
  | 'credits';

export interface MetricOptions {
  tags?: Record<string, string>;
  unit?: MetricUnit;
  timestamp?: Date;
}

export interface Counter {
  increment(value?: number, options?: MetricOptions): void;
  reset(): void;
  getValue(): number;
}

export interface Gauge {
  set(value: number, options?: MetricOptions): void;
  increment(value?: number, options?: MetricOptions): void;
  decrement(value?: number, options?: MetricOptions): void;
  getValue(): number;
}

export interface Histogram {
  observe(value: number, options?: MetricOptions): void;
  reset(): void;
  getStats(): HistogramStats;
}

export interface HistogramStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface Timer {
  start(): TimerEnd;
  observe(duration: number, options?: MetricOptions): void;
}

export interface TimerEnd {
  (options?: MetricOptions): void;
}

export interface MetricCollector {
  counter(name: string, help?: string): Counter;
  gauge(name: string, help?: string): Gauge;
  histogram(name: string, help?: string, buckets?: number[]): Histogram;
  timer(name: string, help?: string): Timer;
  
  // Batch operations
  collectMetrics(): MetricPoint[];
  reset(): void;
}

export interface MetricExporter {
  export(metrics: MetricPoint[]): Promise<void>;
}

export interface MetricConfig {
  prefix?: string;
  defaultTags?: Record<string, string>;
  exportInterval?: number;
  exporters?: MetricExporter[];
  enableRuntimeMetrics?: boolean;
  enableProcessMetrics?: boolean;
}