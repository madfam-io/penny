import type {
  MetricConfig,
  MetricCollector,
  MetricPoint,
  Counter,
  Gauge,
  Histogram,
  Timer,
  MetricOptions,
  TimerEnd,
  HistogramStats,
} from './types.js';
import { PrometheusExporter } from './exporters/prometheus.js';
import { CloudWatchExporter } from './exporters/cloudwatch.js';
import { DatabaseExporter } from './exporters/database.js';
import * as os from 'os';

class CounterImpl implements Counter {
  private value = 0;
  private name: string;
  private help: string;

  constructor(name: string, help = '') {
    this.name = name;
    this.help = help;
  }

  increment(value = 1, options?: MetricOptions): void {
    this.value += value;
  }

  reset(): void {
    this.value = 0;
  }

  getValue(): number {
    return this.value;
  }
}

class GaugeImpl implements Gauge {
  private value = 0;
  private name: string;
  private help: string;

  constructor(name: string, help = '') {
    this.name = name;
    this.help = help;
  }

  set(value: number, options?: MetricOptions): void {
    this.value = value;
  }

  increment(value = 1, options?: MetricOptions): void {
    this.value += value;
  }

  decrement(value = 1, options?: MetricOptions): void {
    this.value -= value;
  }

  getValue(): number {
    return this.value;
  }
}

class HistogramImpl implements Histogram {
  private values: number[] = [];
  private name: string;
  private help: string;
  private buckets: number[];

  constructor(name: string, help = '', buckets?: number[]) {
    this.name = name;
    this.help = help;
    this.buckets = buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  }

  observe(value: number, options?: MetricOptions): void {
    this.values.push(value);
  }

  reset(): void {
    this.values = [];
  }

  getStats(): HistogramStats {
    if (this.values.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...this.values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    const percentile = (p: number) => {
      const index = Math.ceil(count * p) - 1;
      return sorted[Math.max(0, Math.min(index, count - 1))];
    };

    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      mean: sum / count,
      p50: percentile(0.5),
      p90: percentile(0.9),
      p95: percentile(0.95),
      p99: percentile(0.99),
    };
  }
}

class TimerImpl implements Timer {
  private histogram: Histogram;

  constructor(histogram: Histogram) {
    this.histogram = histogram;
  }

  start(): TimerEnd {
    const startTime = Date.now();

    return (options?: MetricOptions) => {
      const duration = Date.now() - startTime;
      this.histogram.observe(duration, options);
    };
  }

  observe(duration: number, options?: MetricOptions): void {
    this.histogram.observe(duration, options);
  }
}

export class MetricsCollector implements MetricCollector {
  private counters = new Map<string, CounterImpl>();
  private gauges = new Map<string, GaugeImpl>();
  private histograms = new Map<string, HistogramImpl>();
  private timers = new Map<string, TimerImpl>();
  private config: MetricConfig;
  private exportInterval?: NodeJS.Timeout;

  constructor(config: MetricConfig = {}) {
    this.config = config;

    // Start runtime metrics collection if enabled
    if (config.enableRuntimeMetrics) {
      this.collectRuntimeMetrics();
    }

    // Start process metrics collection if enabled
    if (config.enableProcessMetrics) {
      this.collectProcessMetrics();
    }

    // Start automatic export if exporters are configured
    if (config.exporters && config.exportInterval) {
      this.startAutoExport();
    }
  }

  counter(name: string, help = ''): Counter {
    const fullName = this.getFullName(name);

    if (!this.counters.has(fullName)) {
      this.counters.set(fullName, new CounterImpl(fullName, help));
    }

    return this.counters.get(fullName)!;
  }

  gauge(name: string, help = ''): Gauge {
    const fullName = this.getFullName(name);

    if (!this.gauges.has(fullName)) {
      this.gauges.set(fullName, new GaugeImpl(fullName, help));
    }

    return this.gauges.get(fullName)!;
  }

  histogram(name: string, help = '', buckets?: number[]): Histogram {
    const fullName = this.getFullName(name);

    if (!this.histograms.has(fullName)) {
      this.histograms.set(fullName, new HistogramImpl(fullName, help, buckets));
    }

    return this.histograms.get(fullName)!;
  }

  timer(name: string, help = ''): Timer {
    const fullName = this.getFullName(name);

    if (!this.timers.has(fullName)) {
      const histogram = this.histogram(`${name}_duration`, help);
      this.timers.set(fullName, new TimerImpl(histogram));
    }

    return this.timers.get(fullName)!;
  }

  collectMetrics(): MetricPoint[] {
    const metrics: MetricPoint[] = [];
    const timestamp = new Date();
    const defaultTags = this.config.defaultTags || {};

    // Collect counters
    for (const [name, counter] of this.counters) {
      metrics.push({
        name,
        value: counter.getValue(),
        timestamp,
        tags: defaultTags,
        unit: 'count',
      });
    }

    // Collect gauges
    for (const [name, gauge] of this.gauges) {
      metrics.push({
        name,
        value: gauge.getValue(),
        timestamp,
        tags: defaultTags,
        unit: 'count',
      });
    }

    // Collect histograms
    for (const [name, histogram] of this.histograms) {
      const stats = histogram.getStats();

      metrics.push({
        name: `${name}_count`,
        value: stats.count,
        timestamp,
        tags: defaultTags,
        unit: 'count',
      });

      metrics.push({
        name: `${name}_sum`,
        value: stats.sum,
        timestamp,
        tags: defaultTags,
        unit: 'milliseconds',
      });

      // Add percentiles
      for (const [percentile, value] of Object.entries({
        p50: stats.p50,
        p90: stats.p90,
        p95: stats.p95,
        p99: stats.p99,
      })) {
        metrics.push({
          name: `${name}_${percentile}`,
          value,
          timestamp,
          tags: { ...defaultTags, percentile },
          unit: 'milliseconds',
        });
      }
    }

    return metrics;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
  }

  private getFullName(name: string): string {
    return this.config.prefix ? `${this.config.prefix}_${name}` : name;
  }

  private collectRuntimeMetrics(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();

      this.gauge('nodejs_heap_used_bytes').set(memUsage.heapUsed);
      this.gauge('nodejs_heap_total_bytes').set(memUsage.heapTotal);
      this.gauge('nodejs_external_memory_bytes').set(memUsage.external);
      this.gauge('nodejs_rss_bytes').set(memUsage.rss);

      if (global.gc) {
        const gcStats = (global as any).gc.getStatistics();
        this.counter('nodejs_gc_runs_total').increment(gcStats.numberOfGCs);
        this.counter('nodejs_gc_duration_seconds').increment(gcStats.totalGCTime);
      }
    }, 10000); // Every 10 seconds
  }

  private collectProcessMetrics(): void {
    setInterval(() => {
      this.gauge('process_cpu_user_seconds_total').set(process.cpuUsage().user / 1000000);
      this.gauge('process_cpu_system_seconds_total').set(process.cpuUsage().system / 1000000);
      this.gauge('process_uptime_seconds').set(process.uptime());

      // System metrics
      this.gauge('system_cpu_count').set(os.cpus().length);
      this.gauge('system_load_average_1m').set(os.loadavg()[0]);
      this.gauge('system_load_average_5m').set(os.loadavg()[1]);
      this.gauge('system_load_average_15m').set(os.loadavg()[2]);
      this.gauge('system_memory_free_bytes').set(os.freemem());
      this.gauge('system_memory_total_bytes').set(os.totalmem());
    }, 10000); // Every 10 seconds
  }

  private async startAutoExport(): Promise<void> {
    if (!this.config.exporters || !this.config.exportInterval) {
      return;
    }

    this.exportInterval = setInterval(async () => {
      const metrics = this.collectMetrics();

      for (const exporter of this.config.exporters!) {
        try {
          await exporter.export(metrics);
        } catch (error) {
          console.error('Failed to export metrics:', error);
        }
      }
    }, this.config.exportInterval);
  }

  stop(): void {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
    }
  }
}

// Global metrics instance
let globalMetrics: MetricsCollector | null = null;

export function initializeMetrics(config: MetricConfig): MetricsCollector {
  globalMetrics = new MetricsCollector(config);
  return globalMetrics;
}

export function getMetrics(): MetricsCollector {
  if (!globalMetrics) {
    globalMetrics = new MetricsCollector();
  }
  return globalMetrics;
}
