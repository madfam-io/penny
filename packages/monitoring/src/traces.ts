import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { EventEmitter } from 'events';
import { TraceSpan, APMTrace } from './types';

export interface TracingConfig {
  serviceName: string;
  environment: string;
  jaegerEndpoint?: string;
  samplingRate?: number;
  enableAutoInstrumentation?: boolean;
  customInstrumentations?: Array<any>;
  enableConsoleExporter?: boolean;
  attributes?: Record<string, string>;
}

export class TracingService extends EventEmitter {
  private sdk: NodeSDK;
  private config: Required<TracingConfig>;
  private traceBuffer: APMTrace[] = [];
  private bufferSize = 1000;
  private started = false;

  constructor(config: TracingConfig) {
    super();
    
    this.config = {
      serviceName: config.serviceName || 'penny-service',
      environment: config.environment || 'development',
      jaegerEndpoint: config.jaegerEndpoint || 'http://localhost:14268/api/traces',
      samplingRate: config.samplingRate || 1.0,
      enableAutoInstrumentation: config.enableAutoInstrumentation !== false,
      customInstrumentations: config.customInstrumentations || [],
      enableConsoleExporter: config.enableConsoleExporter || false,
      attributes: config.attributes || {}
    };

    this.initializeSDK();
  }

  private initializeSDK(): void {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
      ...this.config.attributes
    });

    const traceExporter = new JaegerExporter({
      endpoint: this.config.jaegerEndpoint,
    });

    const instrumentations = [];

    if (this.config.enableAutoInstrumentation) {
      instrumentations.push(getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable fs instrumentation to reduce noise
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false, // Disable DNS instrumentation
        }
      }));
    }

    instrumentations.push(...this.config.customInstrumentations);

    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    
    this.sdk.start();
    this.started = true;
    
    this.emit('started', {
      serviceName: this.config.serviceName,
      environment: this.config.environment,
      jaegerEndpoint: this.config.jaegerEndpoint
    });
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    
    await this.sdk.shutdown();
    this.started = false;
    
    this.emit('stopped');
  }

  // Manual instrumentation helpers
  async traceFunction<T>(
    name: string,
    fn: (span: any) => Promise<T> | T,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
      tags?: Record<string, any>;
    }
  ): Promise<T> {
    const tracer = trace.getTracer(this.config.serviceName);
    
    return tracer.startActiveSpan(name, {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes
    }, async (span) => {
      try {
        // Add custom tags
        if (options?.tags) {
          for (const [key, value] of Object.entries(options.tags)) {
            span.setAttribute(key, typeof value === 'string' ? value : JSON.stringify(value));
          }
        }

        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: any) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  // HTTP request tracing
  traceHttpRequest(req: any, res: any): any {
    const tracer = trace.getTracer(this.config.serviceName);
    
    return tracer.startActiveSpan(`${req.method} ${req.route?.path || req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.user_agent': req.get('User-Agent') || '',
        'http.remote_addr': req.ip,
        'tenant.id': req.tenantId || '',
        'user.id': req.userId || ''
      }
    }, (span) => {
      const startTime = Date.now();

      // Wrap response end to capture response details
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const duration = Date.now() - startTime;
        
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_size': res.get('content-length') || 0,
          'http.duration_ms': duration
        });

        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        // Add to trace buffer for APM
        this.addToTraceBuffer({
          traceId: span.spanContext().traceId,
          duration,
          spans: [this.spanToTraceSpan(span, startTime, duration)],
          service: this.config.serviceName,
          endpoint: `${req.method} ${req.route?.path || req.path}`,
          statusCode: res.statusCode,
          timestamp: new Date(startTime),
          error: res.statusCode >= 400,
          errorMessage: res.statusCode >= 400 ? res.statusMessage : undefined
        });

        span.end();
        originalEnd.apply(this, args);
      }.bind(this);

      return span;
    });
  }

  // Database query tracing
  traceDatabaseQuery(query: string, params?: any[]): any {
    const tracer = trace.getTracer(this.config.serviceName);
    
    return tracer.startActiveSpan('db.query', {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.statement': query,
        'db.operation': this.extractSQLOperation(query)
      }
    });
  }

  // AI model call tracing
  traceAIModelCall(provider: string, model: string, tokens?: { input: number; output: number }): any {
    const tracer = trace.getTracer(this.config.serviceName);
    
    return tracer.startActiveSpan('ai.model_call', {
      kind: SpanKind.CLIENT,
      attributes: {
        'ai.provider': provider,
        'ai.model': model,
        'ai.tokens.input': tokens?.input || 0,
        'ai.tokens.output': tokens?.output || 0
      }
    });
  }

  // Tool execution tracing
  traceToolExecution(toolName: string, parameters?: Record<string, any>): any {
    const tracer = trace.getTracer(this.config.serviceName);
    
    return tracer.startActiveSpan(`tool.${toolName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'tool.name': toolName,
        'tool.parameters': parameters ? JSON.stringify(parameters) : ''
      }
    });
  }

  // Business operation tracing
  traceBusinessOperation(operation: string, metadata?: Record<string, any>): any {
    const tracer = trace.getTracer(this.config.serviceName);
    
    return tracer.startActiveSpan(`business.${operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'business.operation': operation,
        ...metadata
      }
    });
  }

  // Cache operation tracing
  traceCacheOperation(operation: 'get' | 'set' | 'delete', key: string): any {
    const tracer = trace.getTracer(this.config.serviceName);
    
    return tracer.startActiveSpan(`cache.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'cache.operation': operation,
        'cache.key': key
      }
    });
  }

  // Get current trace context
  getCurrentTraceContext(): { traceId?: string; spanId?: string } {
    const span = trace.getActiveSpan();
    if (!span) return {};
    
    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId
    };
  }

  // Create child span
  createChildSpan(name: string, parentSpan?: any): any {
    const tracer = trace.getTracer(this.config.serviceName);
    const activeContext = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();
    
    return tracer.startSpan(name, {}, activeContext);
  }

  // Add custom events to active span
  addEvent(name: string, attributes?: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  // Set custom attributes on active span
  setAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  // Record exception on active span
  recordException(exception: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(exception);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: exception.message
      });
    }
  }

  private addToTraceBuffer(trace: APMTrace): void {
    this.traceBuffer.push(trace);
    if (this.traceBuffer.length > this.bufferSize) {
      this.traceBuffer = this.traceBuffer.slice(-this.bufferSize);
    }
    this.emit('trace', trace);
  }

  private spanToTraceSpan(span: any, startTime: number, duration: number): TraceSpan {
    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      parentSpanId: span.parentSpanId,
      operationName: span.name,
      startTime: new Date(startTime),
      endTime: new Date(startTime + duration),
      duration,
      tags: span.attributes,
      status: {
        code: span.status?.code || SpanStatusCode.OK,
        message: span.status?.message
      }
    };
  }

  private extractSQLOperation(query: string): string {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.startsWith('select')) return 'select';
    if (trimmed.startsWith('insert')) return 'insert';
    if (trimmed.startsWith('update')) return 'update';
    if (trimmed.startsWith('delete')) return 'delete';
    if (trimmed.startsWith('create')) return 'create';
    if (trimmed.startsWith('drop')) return 'drop';
    if (trimmed.startsWith('alter')) return 'alter';
    return 'unknown';
  }

  // Performance analysis
  getSlowTraces(minDuration: number = 1000, limit: number = 50): APMTrace[] {
    return this.traceBuffer
      .filter(trace => trace.duration >= minDuration)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  getErrorTraces(limit: number = 50): APMTrace[] {
    return this.traceBuffer
      .filter(trace => trace.error)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getTracesByEndpoint(endpoint: string, limit: number = 50): APMTrace[] {
    return this.traceBuffer
      .filter(trace => trace.endpoint === endpoint)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getPerformanceStats(timeWindow: number = 3600000): { // 1 hour default
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
  } {
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    const traces = this.traceBuffer.filter(
      trace => trace.timestamp.getTime() >= windowStart
    );

    if (traces.length === 0) {
      return {
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0
      };
    }

    const errorCount = traces.filter(t => t.error).length;
    const durations = traces.map(t => t.duration).sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      totalRequests: traces.length,
      errorRate: (errorCount / traces.length) * 100,
      averageResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p95ResponseTime: durations[p95Index] || 0,
      p99ResponseTime: durations[p99Index] || 0,
      throughput: traces.length / (timeWindow / 1000) // requests per second
    };
  }

  // Custom sampling
  setSamplingRate(rate: number): void {
    this.config.samplingRate = Math.max(0, Math.min(1, rate));
    // Note: This would require SDK restart to take effect
    // In production, you'd want to use remote configuration
  }

  // Export traces for analysis
  exportTraces(format: 'json' | 'jaeger' = 'json'): any {
    if (format === 'json') {
      return {
        traces: this.traceBuffer,
        metadata: {
          serviceName: this.config.serviceName,
          environment: this.config.environment,
          exportTime: new Date().toISOString(),
          traceCount: this.traceBuffer.length
        }
      };
    }
    
    // Convert to Jaeger format if needed
    return this.convertToJaegerFormat();
  }

  private convertToJaegerFormat(): any {
    // Implementation would convert internal trace format to Jaeger JSON format
    // This is a simplified version
    return {
      data: this.traceBuffer.map(trace => ({
        traceID: trace.traceId,
        spans: trace.spans.map(span => ({
          traceID: span.traceId,
          spanID: span.spanId,
          parentSpanID: span.parentSpanId,
          operationName: span.operationName,
          startTime: span.startTime.getTime() * 1000, // microseconds
          duration: (span.duration || 0) * 1000, // microseconds
          tags: Object.entries(span.tags || {}).map(([key, value]) => ({
            key,
            type: typeof value === 'string' ? 'string' : 'number',
            value: value.toString()
          })),
          process: {
            serviceName: this.config.serviceName,
            tags: []
          }
        }))
      }))
    };
  }
}