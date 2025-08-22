import type { FastifyRequest, FastifyReply } from 'fastify';
import { getMetrics } from '../metrics.js';

export interface HttpMetricsOptions {
  includeStatusCode?: boolean;
  includeMethod?: boolean;
  includePath?: boolean;
  normalizePath?: (path: string) => string;
}

export function createHttpMetricsCollector(options: HttpMetricsOptions = {}) {
  const metrics = getMetrics();
  
  // Create metrics
  const requestDuration = metrics.histogram(
    'http_request_duration_milliseconds',
    'Duration of HTTP requests in milliseconds',
    [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
  );
  
  const requestCount = metrics.counter(
    'http_requests_total',
    'Total number of HTTP requests'
  );
  
  const requestsInFlight = metrics.gauge(
    'http_requests_in_flight',
    'Number of HTTP requests currently being processed'
  );
  
  const requestSize = metrics.histogram(
    'http_request_size_bytes',
    'Size of HTTP requests in bytes'
  );
  
  const responseSize = metrics.histogram(
    'http_response_size_bytes',
    'Size of HTTP responses in bytes'
  );

  return {
    onRequest(request: FastifyRequest, reply: FastifyReply) {
      // Start timer
      const timer = Date.now();
      
      // Increment in-flight requests
      requestsInFlight.increment();
      
      // Track request size
      const contentLength = request.headers['content-length'];
      if (contentLength) {
        requestSize.observe(parseInt(contentLength, 10));
      }
      
      // Store timer on request
      (request as any).__metricsTimer = timer;
    },
    
    onResponse(request: FastifyRequest, reply: FastifyReply) {
      const timer = (request as any).__metricsTimer;
      if (!timer) return;
      
      const duration = Date.now() - timer;
      const tags: Record<string, string> = {};
      
      // Add tags based on options
      if (options.includeStatusCode) {
        tags.status_code = String(reply.statusCode);
        tags.status_class = `${Math.floor(reply.statusCode / 100)}xx`;
      }
      
      if (options.includeMethod) {
        tags.method = request.method;
      }
      
      if (options.includePath) {
        const path = options.normalizePath 
          ? options.normalizePath(request.url)
          : request.url;
        tags.path = path;
      }
      
      // Record metrics
      requestDuration.observe(duration, { tags });
      requestCount.increment(1, { tags });
      requestsInFlight.decrement();
      
      // Track response size
      const responseContentLength = reply.getHeader('content-length');
      if (responseContentLength) {
        responseSize.observe(parseInt(responseContentLength as string, 10), { tags });
      }
    },
    
    onError(request: FastifyRequest, reply: FastifyReply, error: Error) {
      const tags: Record<string, string> = {
        error_type: error.name,
      };
      
      if (options.includeMethod) {
        tags.method = request.method;
      }
      
      if (options.includePath) {
        const path = options.normalizePath 
          ? options.normalizePath(request.url)
          : request.url;
        tags.path = path;
      }
      
      // Increment error counter
      metrics.counter('http_errors_total').increment(1, { tags });
      
      // Decrement in-flight if not already done
      if ((request as any).__metricsTimer) {
        requestsInFlight.decrement();
      }
    },
  };
}