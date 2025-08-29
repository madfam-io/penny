import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import {
  initializeMetrics,
  PrometheusExporter,
  DatabaseExporter,
  createHttpMetricsCollector,
  createDatabaseMetricsCollector,
  createAIMetricsCollector,
  prometheusPlugin,
} from '@penny/telemetry';

const metricsPlugin: FastifyPluginAsync = async (fastify) => {
  // Initialize exporters
  const prometheusExporter = new PrometheusExporter();
  const databaseExporter = new DatabaseExporter();

  // Initialize metrics system
  const metrics = initializeMetrics({
    prefix: 'penny',
    defaultTags: {
      service: 'api',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '0.0.1',
    },
    exportInterval: 60000, // Export every minute
    exporters: [prometheusExporter, databaseExporter],
    enableRuntimeMetrics: true,
    enableProcessMetrics: true,
  });

  // Create collectors
  const httpCollector = createHttpMetricsCollector({
    includeStatusCode: true,
    includeMethod: true,
    includePath: true,
    normalizePath: (path) => {
      // Normalize paths to avoid high cardinality
      return path
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
        .replace(/\?.*$/, '');
    },
  });

  const aiCollector = createAIMetricsCollector({
    includeModel: true,
    includeProvider: true,
    includeTenant: true,
  });

  // Register HTTP metrics hooks
  fastify.addHook('onRequest', httpCollector.onRequest);
  fastify.addHook('onResponse', httpCollector.onResponse);
  fastify.addHook('onError', httpCollector.onError);

  // Register Prometheus endpoint
  await fastify.register(prometheusPlugin, {
    exporter: prometheusExporter,
  });

  // Decorate fastify with metrics and collectors
  fastify.decorate('metrics', metrics);
  fastify.decorate('aiMetrics', aiCollector);

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    metrics.stop();
  });
};

export default fp(metricsPlugin, {
  name: 'metrics',
});
