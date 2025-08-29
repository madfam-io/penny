import {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum,
  Dimension,
} from '@aws-sdk/client-cloudwatch';
import type { MetricExporter, MetricPoint } from '../types.js';

export interface CloudWatchExporterConfig {
  namespace: string;
  region: string;
  batchSize?: number;
  dimensions?: Record<string, string>;
}

export class CloudWatchExporter implements MetricExporter {
  private client: CloudWatchClient;
  private config: CloudWatchExporterConfig;

  constructor(config: CloudWatchExporterConfig) {
    this.config = {
      batchSize: 20,
      ...config,
    };

    this.client = new CloudWatchClient({
      region: config.region,
    });
  }

  async export(metrics: MetricPoint[]): Promise<void> {
    // CloudWatch has a limit of 20 metric data points per request
    const batches = this.createBatches(metrics, this.config.batchSize!);

    for (const batch of batches) {
      await this.sendBatch(batch);
    }
  }

  private createBatches(metrics: MetricPoint[], batchSize: number): MetricPoint[][] {
    const batches: MetricPoint[][] = [];

    for (let i = 0; i < metrics.length; i += batchSize) {
      batches.push(metrics.slice(i, i + batchSize));
    }

    return batches;
  }

  private async sendBatch(metrics: MetricPoint[]): Promise<void> {
    const metricData: MetricDatum[] = metrics.map((metric) => {
      const dimensions: Dimension[] = [];

      // Add global dimensions
      if (this.config.dimensions) {
        for (const [name, value] of Object.entries(this.config.dimensions)) {
          dimensions.push({ Name: name, Value: value });
        }
      }

      // Add metric-specific dimensions
      if (metric.tags) {
        for (const [name, value] of Object.entries(metric.tags)) {
          dimensions.push({ Name: name, Value: value });
        }
      }

      return {
        MetricName: metric.name,
        Value: metric.value,
        Unit: this.mapUnit(metric.unit),
        Timestamp: metric.timestamp,
        Dimensions: dimensions.length > 0 ? dimensions : undefined,
      };
    });

    const command = new PutMetricDataCommand({
      Namespace: this.config.namespace,
      MetricData: metricData,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      console.error('Failed to send metrics to CloudWatch:', error);
      throw error;
    }
  }

  private mapUnit(unit?: string): string {
    switch (unit) {
      case 'bytes':
        return 'Bytes';
      case 'milliseconds':
        return 'Milliseconds';
      case 'seconds':
        return 'Seconds';
      case 'percent':
        return 'Percent';
      case 'count':
      case 'requests':
      case 'errors':
      case 'credits':
        return 'Count';
      default:
        return 'None';
    }
  }
}
