import { prisma } from '@penny/database';
import type { MetricExporter, MetricPoint } from '../types.js';

export interface DatabaseExporterConfig {
  batchSize?: number;
  tenantId?: string;
}

export class DatabaseExporter implements MetricExporter {
  private config: DatabaseExporterConfig;

  constructor(config: DatabaseExporterConfig = {}) {
    this.config = {
      batchSize: 100,
      ...config,
    };
  }

  async export(metrics: MetricPoint[]): Promise<void> {
    const batches = this.createBatches(metrics, this.config.batchSize!);

    for (const batch of batches) {
      await this.saveBatch(batch);
    }
  }

  private createBatches(metrics: MetricPoint[], batchSize: number): MetricPoint[][] {
    const batches: MetricPoint[][] = [];

    for (let i = 0; i < metrics.length; i += batchSize) {
      batches.push(metrics.slice(i, i + batchSize));
    }

    return batches;
  }

  private async saveBatch(metrics: MetricPoint[]): Promise<void> {
    try {
      await prisma.metric.createMany({
        data: metrics.map((metric) => ({
          name: metric.name,
          value: metric.value,
          timestamp: metric.timestamp,
          tags: metric.tags || {},
          unit: metric.unit || 'count',
          tenantId: this.config.tenantId || metric.tags?.tenant_id,
        })),
      });

      // Aggregate usage metrics for billing
      await this.aggregateUsageMetrics(metrics);
    } catch (error) {
      console.error('Failed to save metrics to database:', error);
      throw error;
    }
  }

  private async aggregateUsageMetrics(metrics: MetricPoint[]): Promise<void> {
    // Group metrics by tenant and type
    const usageByTenant = new Map<string, Map<string, number>>();

    for (const metric of metrics) {
      const tenantId = this.config.tenantId || metric.tags?.tenant_id;
      if (!tenantId) continue;

      // Only aggregate specific usage metrics
      if (this.isUsageMetric(metric.name)) {
        if (!usageByTenant.has(tenantId)) {
          usageByTenant.set(tenantId, new Map());
        }

        const tenantUsage = usageByTenant.get(tenantId)!;
        const current = tenantUsage.get(metric.name) || 0;
        tenantUsage.set(metric.name, current + metric.value);
      }
    }

    // Update usage metrics in database
    for (const [tenantId, usage] of usageByTenant) {
      for (const [metricName, value] of usage) {
        await prisma.usageMetric.create({
          data: {
            tenantId,
            metric: metricName,
            value,
            unit: this.getUsageUnit(metricName),
            metadata: {
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    }
  }

  private isUsageMetric(name: string): boolean {
    const usageMetrics = [
      'ai_completion_tokens_total',
      'ai_completion_cost_cents',
      'ai_embedding_tokens_total',
      'ai_embedding_cost_cents',
      'tool_execution',
      'storage_bytes_used',
      'api_requests_total',
    ];

    return usageMetrics.some((metric) => name.includes(metric));
  }

  private getUsageUnit(metricName: string): string {
    if (metricName.includes('tokens')) return 'tokens';
    if (metricName.includes('cost')) return 'cents';
    if (metricName.includes('bytes')) return 'bytes';
    if (metricName.includes('requests')) return 'requests';
    return 'count';
  }
}
