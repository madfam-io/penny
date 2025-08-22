import type { TenantId } from '@penny/shared';
import type {
  ModelProvider,
  CompletionRequest,
  ModelRoutingPolicy,
  RoutingRule,
} from './types.js';

export class ModelRouter {
  private providers: Map<string, ModelProvider>;
  private defaultPolicy: ModelRoutingPolicy = {
    defaultModel: 'gpt-3.5-turbo',
    fallbackModels: ['claude-3-haiku-20240307', 'mock-gpt-3.5'],
    rules: [
      {
        condition: {
          type: 'complexity',
          operator: 'gt',
          value: 0.7,
        },
        model: 'gpt-4-turbo-preview',
        priority: 1,
      },
      {
        condition: {
          type: 'capability',
          operator: 'contains',
          value: 'vision',
        },
        model: 'gpt-4-vision-preview',
        priority: 2,
      },
      {
        condition: {
          type: 'cost',
          operator: 'lt',
          value: 0.001,
        },
        model: 'claude-3-haiku-20240307',
        priority: 3,
      },
    ],
  };

  constructor(providers: Map<string, ModelProvider>) {
    this.providers = providers;
  }

  async selectProvider(
    request: CompletionRequest,
    tenantId?: TenantId,
  ): Promise<ModelProvider | null> {
    // Get routing policy (could be tenant-specific in the future)
    const policy = await this.getRoutingPolicy(tenantId);
    
    // Apply routing rules
    const selectedModel = this.applyRoutingRules(request, policy);
    
    // Find provider for the selected model
    return this.findProviderForModel(selectedModel);
  }

  async getFallbackProvider(
    request: CompletionRequest,
    tenantId?: TenantId,
  ): Promise<ModelProvider | null> {
    const policy = await this.getRoutingPolicy(tenantId);
    
    for (const fallbackModel of policy.fallbackModels) {
      const provider = await this.findProviderForModel(fallbackModel);
      if (provider) {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          return provider;
        }
      }
    }
    
    return null;
  }

  private async getRoutingPolicy(tenantId?: TenantId): Promise<ModelRoutingPolicy> {
    // TODO: Load tenant-specific routing policy from database
    return this.defaultPolicy;
  }

  private applyRoutingRules(
    request: CompletionRequest,
    policy: ModelRoutingPolicy,
  ): string {
    // Sort rules by priority
    const sortedRules = [...policy.rules].sort((a, b) => a.priority - b.priority);
    
    // Check each rule
    for (const rule of sortedRules) {
      if (this.evaluateCondition(request, rule.condition)) {
        return rule.model;
      }
    }
    
    // Use requested model if no rules match
    return request.model || policy.defaultModel;
  }

  private evaluateCondition(
    request: CompletionRequest,
    condition: RoutingRule['condition'],
  ): boolean {
    switch (condition.type) {
      case 'complexity':
        const complexity = this.calculateComplexity(request);
        return this.compareValues(complexity, condition.operator, condition.value);
      
      case 'capability':
        const hasCapability = this.checkCapability(request, condition.value);
        return hasCapability;
      
      case 'cost':
        const estimatedCost = this.estimateCost(request);
        return this.compareValues(estimatedCost, condition.operator, condition.value);
      
      case 'latency':
        // Could check historical latency data
        return false;
      
      case 'language':
        const language = this.detectLanguage(request);
        return this.compareValues(language, condition.operator, condition.value);
      
      default:
        return false;
    }
  }

  private calculateComplexity(request: CompletionRequest): number {
    // Simple heuristic based on message length and tool usage
    const messageLength = request.messages.reduce(
      (sum, msg) => sum + (typeof msg.content === 'string' ? msg.content.length : 0),
      0,
    );
    
    const hasTools = request.tools && request.tools.length > 0;
    const hasManyMessages = request.messages.length > 10;
    
    let complexity = messageLength / 10000; // Normalize by 10k chars
    if (hasTools) complexity += 0.3;
    if (hasManyMessages) complexity += 0.2;
    
    return Math.min(complexity, 1.0);
  }

  private checkCapability(request: CompletionRequest, capability: string): boolean {
    switch (capability) {
      case 'vision':
        return request.messages.some(msg => 
          Array.isArray(msg.content) && 
          msg.content.some(c => c.type === 'image_url')
        );
      
      case 'function_calling':
        return request.tools !== undefined && request.tools.length > 0;
      
      default:
        return false;
    }
  }

  private estimateCost(request: CompletionRequest): number {
    // Rough estimate based on token count
    const estimatedTokens = request.messages.reduce(
      (sum, msg) => sum + (typeof msg.content === 'string' ? msg.content.length / 4 : 0),
      0,
    );
    
    // Assume average cost of $0.002 per 1k tokens
    return (estimatedTokens / 1000) * 0.002;
  }

  private detectLanguage(request: CompletionRequest): string {
    // Simple language detection (in production, use a proper library)
    const text = request.messages
      .map(msg => typeof msg.content === 'string' ? msg.content : '')
      .join(' ');
    
    // Check for common non-English characters
    if (/[\u4e00-\u9fa5]/.test(text)) return 'zh'; // Chinese
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'; // Japanese
    if (/[\u0600-\u06ff]/.test(text)) return 'ar'; // Arabic
    
    return 'en';
  }

  private compareValues(
    value: any,
    operator: RoutingRule['condition']['operator'],
    target: any,
  ): boolean {
    switch (operator) {
      case 'eq':
        return value === target;
      case 'gt':
        return value > target;
      case 'lt':
        return value < target;
      case 'contains':
        return String(value).includes(String(target));
      case 'matches':
        return new RegExp(String(target)).test(String(value));
      default:
        return false;
    }
  }

  private async findProviderForModel(modelId: string): Promise<ModelProvider | null> {
    // Check each provider
    for (const [name, provider] of this.providers) {
      try {
        const models = await provider.listModels();
        if (models.some(m => m.id === modelId)) {
          return provider;
        }
      } catch (error) {
        console.error(`Error checking provider ${name}:`, error);
      }
    }
    
    // Special handling for mock models
    if (modelId.startsWith('mock-')) {
      return this.providers.get('mock') || null;
    }
    
    return null;
  }
}