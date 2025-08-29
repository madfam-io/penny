import type { MetricExporter, MetricPoint } from '../types.js';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

export class PrometheusExporter implements MetricExporter {
  private metrics: MetricPoint[] = [];

  async export(metrics: MetricPoint[]): Promise<void> {
    // Store metrics for retrieval
    this.metrics = metrics;
  }

  formatMetrics(): string {
    const lines: string[] = [];
    const processedMetrics = new Map<string, MetricPoint[]>();

    // Group metrics by name
    for (const metric of this.metrics) {
      if (!processedMetrics.has(metric.name)) {
        processedMetrics.set(metric.name, []);
      }
      processedMetrics.get(metric.name)!.push(metric);
    }

    // Format each metric
    for (const [name, points] of processedMetrics) {
      // Add help text
      lines.push(`# HELP ${name} ${name}`);

      // Add type
      const type = this.inferType(name);
      lines.push(`# TYPE ${name} ${type}`);

      // Add metric values
      for (const point of points) {
        const labels = this.formatLabels(point.tags);
        const timestamp = point.timestamp.getTime();

        if (labels) {
          lines.push(`${name}{${labels}} ${point.value} ${timestamp}`);
        } else {
          lines.push(`${name} ${point.value} ${timestamp}`);
        }
      }

      lines.push(''); // Empty line between metrics
    }

    return lines.join('\n');
  }

  private inferType(name: string): string {
    if (name.includes('_total') || name.includes('_count')) {
      return 'counter';
    }
    if (name.includes('_gauge') || name.includes('_current') || name.includes('_info')) {
      return 'gauge';
    }
    if (name.includes('_bucket') || name.includes('_sum') || name.includes('_count')) {
      return 'histogram';
    }
    return 'gauge'; // Default
  }

  private formatLabels(tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return '';
    }

    return Object.entries(tags)
      .map(([key, value]) => `${key}="${this.escapeValue(value)}"`)
      .join(',');
  }

  private escapeValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}

// Fastify plugin for Prometheus metrics endpoint
export const prometheusPlugin: FastifyPluginAsync<{ exporter: PrometheusExporter }> = async (
  fastify,
  options,
) => {
  const { exporter } = options;

  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = exporter.formatMetrics();

    reply.type('text/plain; version=0.0.4').send(metrics);
  });
};
