import type { TenantId } from '@penny/shared';
import { prisma, type Tenant } from '@penny/database';
import PQueue from 'p-queue';
import Redis from 'ioredis';
import type {
  ModelProvider,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
} from './types.js';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { MockProvider } from './providers/mock.js';
import { ModelRouter } from './router.js';

export interface ModelOrchestratorConfig {
  providers?: Record<string, ModelProvider>;
  redis?: Redis;
  maxConcurrency?: number;
  defaultTimeout?: number;
}

export class ModelOrchestrator {
  private providers: Map<string, ModelProvider> = new Map();
  private router: ModelRouter;
  private queue: PQueue;
  private redis?: Redis;
  private modelCache: Map<string, ModelInfo[]> = new Map();
  private cacheExpiry = 3600 * 1000; // 1 hour

  constructor(config: ModelOrchestratorConfig = {}) {
    // Initialize providers
    this.initializeProviders(config.providers);
    
    // Initialize router
    this.router = new ModelRouter(this.providers);
    
    // Initialize queue for rate limiting
    this.queue = new PQueue({
      concurrency: config.maxConcurrency || 10,
      interval: 1000,
      intervalCap: 50,
    });
    
    // Initialize Redis if provided
    this.redis = config.redis;
  }

  private initializeProviders(customProviders?: Record<string, ModelProvider>) {
    // Default providers
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('openai', new OpenAIProvider());
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', new AnthropicProvider());
    }
    
    // Always include mock provider for development
    this.providers.set('mock', new MockProvider());
    
    // Add custom providers
    if (customProviders) {
      Object.entries(customProviders).forEach(([name, provider]) => {
        this.providers.set(name, provider);
      });
    }
  }

  async listAvailableModels(tenantId?: TenantId): Promise<ModelInfo[]> {
    const cacheKey = `models:${tenantId || 'global'}`;
    
    // Check cache
    if (this.modelCache.has(cacheKey)) {
      const cached = this.modelCache.get(cacheKey)!;
      return cached;
    }
    
    // Get tenant settings if provided
    let enabledProviders: string[] = Array.from(this.providers.keys());
    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      
      if (tenant?.settings && typeof tenant.settings === 'object') {
        const settings = tenant.settings as any;
        if (settings.features?.enabledModels) {
          // Filter providers based on enabled models
          enabledProviders = enabledProviders.filter(provider => 
            settings.features.enabledModels.some((model: string) => 
              model.toLowerCase().includes(provider)
            )
          );
        }
      }
    }
    
    // Fetch models from enabled providers
    const allModels: ModelInfo[] = [];
    
    for (const [name, provider] of this.providers) {
      if (!enabledProviders.includes(name)) continue;
      
      try {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          const models = await provider.listModels();
          allModels.push(...models);
        }
      } catch (error) {
        console.error(`Failed to list models from ${name}:`, error);
      }
    }
    
    // Cache results
    this.modelCache.set(cacheKey, allModels);
    setTimeout(() => this.modelCache.delete(cacheKey), this.cacheExpiry);
    
    return allModels;
  }

  async generateCompletion(
    request: CompletionRequest,
    options: {
      tenantId?: TenantId;
      userId?: string;
      conversationId?: string;
    } = {},
  ): Promise<CompletionResponse> {
    return this.queue.add(async () => {
      // Track start time for metrics
      const startTime = Date.now();
      
      try {
        // Route to appropriate provider
        const provider = await this.router.selectProvider(request, options.tenantId);
        if (!provider) {
          throw new Error('No available provider for request');
        }
        
        // Generate completion
        const response = await provider.generateCompletion(request);
        
        // Track usage metrics
        if (options.tenantId && response.usage) {
          await this.trackUsage(
            options.tenantId,
            provider.name,
            request.model,
            response.usage,
            Date.now() - startTime,
          );
        }
        
        return response;
      } catch (error) {
        // Log error
        console.error('Model completion error:', error);
        
        // Try fallback if available
        const fallbackProvider = await this.router.getFallbackProvider(request, options.tenantId);
        if (fallbackProvider) {
          console.log(`Falling back to ${fallbackProvider.name}`);
          return fallbackProvider.generateCompletion(request);
        }
        
        throw error;
      }
    });
  }

  async *generateStream(
    request: CompletionRequest,
    options: {
      tenantId?: TenantId;
      userId?: string;
      conversationId?: string;
    } = {},
  ): AsyncGenerator<CompletionChunk> {
    // Note: Streaming bypasses the queue to avoid blocking
    const startTime = Date.now();
    let tokenCount = 0;
    
    try {
      // Route to appropriate provider
      const provider = await this.router.selectProvider(request, options.tenantId);
      if (!provider) {
        throw new Error('No available provider for request');
      }
      
      // Generate stream
      for await (const chunk of provider.generateStream(request)) {
        tokenCount++; // Approximate token count
        yield chunk;
      }
      
      // Track usage metrics (approximate)
      if (options.tenantId) {
        await this.trackUsage(
          options.tenantId,
          provider.name,
          request.model,
          {
            promptTokens: request.messages.join('').length / 4, // Rough estimate
            completionTokens: tokenCount,
            totalTokens: request.messages.join('').length / 4 + tokenCount,
          },
          Date.now() - startTime,
        );
      }
    } catch (error) {
      console.error('Model streaming error:', error);
      throw error;
    }
  }

  private async trackUsage(
    tenantId: TenantId,
    provider: string,
    model: string,
    usage: { promptTokens: number; completionTokens: number; totalTokens: number },
    duration: number,
  ) {
    try {
      // Store in database
      await prisma.usageMetric.createMany({
        data: [
          {
            tenantId,
            metric: 'tokens_input',
            value: usage.promptTokens,
            unit: 'count',
            metadata: { provider, model },
          },
          {
            tenantId,
            metric: 'tokens_output',
            value: usage.completionTokens,
            unit: 'count',
            metadata: { provider, model },
          },
          {
            tenantId,
            metric: 'model_latency',
            value: duration,
            unit: 'milliseconds',
            metadata: { provider, model },
          },
        ],
      });
      
      // Update Redis counters if available
      if (this.redis) {
        const dayKey = new Date().toISOString().split('T')[0];
        const keys = [
          `usage:${tenantId}:${dayKey}:tokens`,
          `usage:${tenantId}:${dayKey}:requests`,
        ];
        
        await this.redis
          .multi()
          .incrby(keys[0], usage.totalTokens)
          .incr(keys[1])
          .expire(keys[0], 86400 * 30) // 30 days
          .expire(keys[1], 86400 * 30)
          .exec();
      }
    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  async getUsageStats(tenantId: TenantId, date?: Date): Promise<{
    tokens: number;
    requests: number;
    cost: number;
  }> {
    const targetDate = date || new Date();
    const dayKey = targetDate.toISOString().split('T')[0];
    
    if (this.redis) {
      const [tokens, requests] = await this.redis.mget(
        `usage:${tenantId}:${dayKey}:tokens`,
        `usage:${tenantId}:${dayKey}:requests`,
      );
      
      return {
        tokens: parseInt(tokens || '0', 10),
        requests: parseInt(requests || '0', 10),
        cost: 0, // TODO: Calculate based on model pricing
      };
    }
    
    // Fallback to database
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const metrics = await prisma.usageMetric.aggregate({
      where: {
        tenantId,
        metric: { in: ['tokens_input', 'tokens_output'] },
        timestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      _sum: {
        value: true,
      },
    });
    
    return {
      tokens: metrics._sum.value || 0,
      requests: 0, // TODO: Count from database
      cost: 0, // TODO: Calculate based on model pricing
    };
  }
}