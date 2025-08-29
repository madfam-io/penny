import winston from 'winston';
import { EventEmitter } from 'events';
import { LogEntry } from './types';

export interface LoggingConfig {
  level?: string;
  serviceName?: string;
  environment?: string;
  format?: 'json' | 'text';
  transports?: Array<{
    type: 'console' | 'file' | 'http' | 'elasticsearch';
    config: any;
  }>;
  enableTracing?: boolean;
  enableStructuredLogging?: boolean;
}

export class LoggingService extends EventEmitter {
  private logger: winston.Logger;
  private config: Required<LoggingConfig>;
  private logBuffer: LogEntry[] = [];
  private bufferSize = 1000;

  constructor(config: LoggingConfig = {}) {
    super();
    
    this.config = {
      level: config.level || 'info',
      serviceName: config.serviceName || 'penny-service',
      environment: config.environment || 'development',
      format: config.format || 'json',
      transports: config.transports || [{ type: 'console', config: {} }],
      enableTracing: config.enableTracing !== false,
      enableStructuredLogging: config.enableStructuredLogging !== false
    };

    this.initializeLogger();
  }

  private initializeLogger(): void {
    const customFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const logEntry: LogEntry = {
          level: level as any,
          message: stack || message,
          timestamp: new Date(timestamp),
          service: this.config.serviceName,
          environment: this.config.environment,
          metadata: meta
        };

        // Add to buffer for querying
        this.addToBuffer(logEntry);

        if (this.config.format === 'json') {
          return JSON.stringify(logEntry);
        } else {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
        }
      })
    );

    const transports: winston.transport[] = [];

    for (const transportConfig of this.config.transports) {
      switch (transportConfig.type) {
        case 'console':
          transports.push(new winston.transports.Console({
            format: this.config.format === 'json' ? customFormat : winston.format.combine(
              winston.format.colorize(),
              customFormat
            ),
            ...transportConfig.config
          }));
          break;
          
        case 'file':
          transports.push(new winston.transports.File({
            filename: transportConfig.config.filename || 'app.log',
            format: customFormat,
            ...transportConfig.config
          }));
          break;
          
        case 'http':
          transports.push(new winston.transports.Http({
            host: transportConfig.config.host,
            port: transportConfig.config.port,
            path: transportConfig.config.path || '/logs',
            format: customFormat,
            ...transportConfig.config
          }));
          break;
      }
    }

    this.logger = winston.createLogger({
      level: this.config.level,
      transports,
      defaultMeta: {
        service: this.config.serviceName,
        environment: this.config.environment
      }
    });
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.bufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.bufferSize);
    }
    this.emit('log', entry);
  }

  async start(): Promise<void> {
    this.logger.info('Logging service started', {
      level: this.config.level,
      format: this.config.format,
      transports: this.config.transports.length
    });
    
    this.emit('started');
  }

  async stop(): Promise<void> {
    // Close all transports
    this.logger.close();
    this.emit('stopped');
  }

  // Standard logging methods
  error(message: string, meta: Record<string, any> = {}): void {
    this.logger.error(message, this.enrichMetadata(meta));
  }

  warn(message: string, meta: Record<string, any> = {}): void {
    this.logger.warn(message, this.enrichMetadata(meta));
  }

  info(message: string, meta: Record<string, any> = {}): void {
    this.logger.info(message, this.enrichMetadata(meta));
  }

  debug(message: string, meta: Record<string, any> = {}): void {
    this.logger.debug(message, this.enrichMetadata(meta));
  }

  trace(message: string, meta: Record<string, any> = {}): void {
    this.logger.silly(message, this.enrichMetadata(meta));
  }

  // Structured logging methods
  logHttpRequest(req: any, res: any, responseTime: number): void {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      tenantId: req.tenantId,
      userId: req.userId
    });
  }

  logError(error: Error, context: Record<string, any> = {}): void {
    this.error('Application Error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...context
    });
  }

  logSecurityEvent(eventType: string, details: Record<string, any>): void {
    this.warn('Security Event', {
      eventType,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  logBusinessEvent(eventType: string, details: Record<string, any>): void {
    this.info('Business Event', {
      eventType,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  logPerformanceMetric(metric: string, value: number, unit: string, context: Record<string, any> = {}): void {
    this.info('Performance Metric', {
      metric,
      value,
      unit,
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  logDatabaseQuery(query: string, duration: number, success: boolean, context: Record<string, any> = {}): void {
    const level = success ? 'debug' : 'error';
    this[level]('Database Query', {
      query: query.substring(0, 500), // Truncate long queries
      duration,
      success,
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  logToolExecution(toolName: string, duration: number, success: boolean, context: Record<string, any> = {}): void {
    const level = success ? 'info' : 'error';
    this[level]('Tool Execution', {
      toolName,
      duration,
      success,
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  logAIModelCall(model: string, provider: string, tokens: { input: number; output: number }, duration: number, context: Record<string, any> = {}): void {
    this.info('AI Model Call', {
      model,
      provider,
      tokens,
      duration,
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  // Query methods
  getLogs(options: {
    level?: string;
    service?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): LogEntry[] {
    let filtered = this.logBuffer;

    if (options.level) {
      const levelPriorities = { trace: 0, debug: 1, info: 2, warn: 3, error: 4 };
      const minPriority = levelPriorities[options.level as keyof typeof levelPriorities];
      filtered = filtered.filter(entry => 
        levelPriorities[entry.level as keyof typeof levelPriorities] >= minPriority
      );
    }

    if (options.service) {
      filtered = filtered.filter(entry => entry.service === options.service);
    }

    if (options.startTime) {
      filtered = filtered.filter(entry => entry.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      filtered = filtered.filter(entry => entry.timestamp <= options.endTime!);
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(entry.metadata).toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    return filtered.slice(offset, offset + limit);
  }

  getLogStats(): {
    total: number;
    byLevel: Record<string, number>;
    byService: Record<string, number>;
  } {
    const byLevel: Record<string, number> = {};
    const byService: Record<string, number> = {};

    for (const entry of this.logBuffer) {
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
      if (entry.service) {
        byService[entry.service] = (byService[entry.service] || 0) + 1;
      }
    }

    return {
      total: this.logBuffer.length,
      byLevel,
      byService
    };
  }

  // Create child logger with additional context
  child(meta: Record<string, any>): winston.Logger {
    return this.logger.child(meta);
  }

  private enrichMetadata(meta: Record<string, any>): Record<string, any> {
    const enriched = { ...meta };

    // Add tracing context if available
    if (this.config.enableTracing) {
      // This would integrate with OpenTelemetry context
      // const span = trace.getActiveSpan();
      // if (span) {
      //   const spanContext = span.spanContext();
      //   enriched.traceId = spanContext.traceId;
      //   enriched.spanId = spanContext.spanId;
      // }
    }

    // Add timestamp
    enriched.timestamp = new Date().toISOString();

    return enriched;
  }

  // Stream logs in real-time
  createLogStream(): NodeJS.ReadableStream {
    const { Readable } = require('stream');
    const stream = new Readable({
      objectMode: true,
      read() {}
    });

    this.on('log', (entry: LogEntry) => {
      stream.push(entry);
    });

    return stream;
  }
}