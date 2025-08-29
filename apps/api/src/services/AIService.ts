import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: any;
}

interface CompletionOptions {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
}

interface StreamCompletionOptions extends CompletionOptions {
  onChunk?: (chunk: any) => void;
}

interface CompletionResult {
  content: string;
  toolCalls?: any[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

interface StreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: any;
  error?: string;
}

export class AIService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private defaultModel: string;
  private modelConfig: Map<string, any>;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.defaultModel = process.env.DEFAULT_AI_MODEL || 'gpt-4-turbo-preview';
    
    this.modelConfig = new Map([
      ['gpt-4-turbo-preview', { provider: 'openai', maxTokens: 128000, costPer1kTokens: { input: 0.01, output: 0.03 } }],
      ['gpt-4o', { provider: 'openai', maxTokens: 128000, costPer1kTokens: { input: 0.005, output: 0.015 } }],
      ['gpt-3.5-turbo', { provider: 'openai', maxTokens: 16385, costPer1kTokens: { input: 0.0005, output: 0.0015 } }],
      ['claude-3-opus', { provider: 'anthropic', maxTokens: 200000, costPer1kTokens: { input: 0.015, output: 0.075 } }],
      ['claude-3-sonnet', { provider: 'anthropic', maxTokens: 200000, costPer1kTokens: { input: 0.003, output: 0.015 } }],
      ['claude-3-haiku', { provider: 'anthropic', maxTokens: 200000, costPer1kTokens: { input: 0.00025, output: 0.00125 } }],
    ]);
  }

  async generateCompletion(options: CompletionOptions): Promise<CompletionResult> {
    const {
      messages,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 4096,
      tools,
    } = options;

    const modelConfig = this.modelConfig.get(model);
    if (!modelConfig) {
      throw new Error(`Unsupported model: ${model}`);
    }

    if (modelConfig.provider === 'openai') {
      return this.generateOpenAICompletion({
        messages,
        model,
        temperature,
        maxTokens,
        tools,
      });
    } else if (modelConfig.provider === 'anthropic') {
      return this.generateAnthropicCompletion({
        messages,
        model,
        temperature,
        maxTokens,
        tools,
      });
    } else {
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    }
  }

  async *streamCompletion(options: StreamCompletionOptions): AsyncGenerator<StreamChunk> {
    const {
      messages,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 4096,
      tools,
    } = options;

    const modelConfig = this.modelConfig.get(model);
    if (!modelConfig) {
      throw new Error(`Unsupported model: ${model}`);
    }

    if (modelConfig.provider === 'openai') {
      yield* this.streamOpenAICompletion({
        messages,
        model,
        temperature,
        maxTokens,
        tools,
      });
    } else if (modelConfig.provider === 'anthropic') {
      yield* this.streamAnthropicCompletion({
        messages,
        model,
        temperature,
        maxTokens,
        tools,
      });
    } else {
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    }
  }

  private async generateOpenAICompletion(options: CompletionOptions): Promise<CompletionResult> {
    const { messages, model, temperature, maxTokens, tools } = options;

    const completion = await this.openai.chat.completions.create({
      model: model!,
      messages: messages.map(msg => ({
        role: msg.role as any,
        content: msg.content,
        ...(msg.toolCalls && { tool_calls: msg.toolCalls }),
      })),
      temperature,
      max_tokens: maxTokens,
      ...(tools && tools.length > 0 && { tools }),
    });

    const choice = completion.choices[0];
    if (!choice) {
      throw new Error('No completion choice returned');
    }

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls,
      tokenUsage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
      model,
    };
  }

  private async *streamOpenAICompletion(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    const { messages, model, temperature, maxTokens, tools } = options;

    try {
      const stream = await this.openai.chat.completions.create({
        model: model!,
        messages: messages.map(msg => ({
          role: msg.role as any,
          content: msg.content,
          ...(msg.toolCalls && { tool_calls: msg.toolCalls }),
        })),
        temperature,
        max_tokens: maxTokens,
        ...(tools && tools.length > 0 && { tools }),
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          yield {
            type: 'content',
            content: delta.content,
          };
        }

        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            yield {
              type: 'tool_call',
              toolCall,
            };
          }
        }

        if (chunk.choices[0]?.finish_reason) {
          yield { type: 'done' };
          break;
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error.message,
      };
    }
  }

  private async generateAnthropicCompletion(options: CompletionOptions): Promise<CompletionResult> {
    const { messages, model, temperature, maxTokens, tools } = options;

    // Convert messages format for Anthropic
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await this.anthropic.messages.create({
      model: model!,
      max_tokens: maxTokens!,
      temperature,
      system: systemMessage?.content,
      messages: conversationMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
      ...(tools && tools.length > 0 && { tools }),
    });

    const textContent = response.content.find(c => c.type === 'text');
    const toolUseContent = response.content.filter(c => c.type === 'tool_use');

    return {
      content: textContent?.text || '',
      toolCalls: toolUseContent.length > 0 ? toolUseContent : undefined,
      tokenUsage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model,
    };
  }

  private async *streamAnthropicCompletion(options: CompletionOptions): AsyncGenerator<StreamChunk> {
    const { messages, model, temperature, maxTokens, tools } = options;

    try {
      // Convert messages format for Anthropic
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const stream = await this.anthropic.messages.create({
        model: model!,
        max_tokens: maxTokens!,
        temperature,
        system: systemMessage?.content,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        })),
        ...(tools && tools.length > 0 && { tools }),
        stream: true,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield {
            type: 'content',
            content: chunk.delta.text,
          };
        }

        if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
          yield {
            type: 'tool_call',
            toolCall: chunk.content_block,
          };
        }

        if (chunk.type === 'message_stop') {
          yield { type: 'done' };
          break;
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error.message,
      };
    }
  }

  async countTokens(text: string, model?: string): Promise<number> {
    // Rough estimation: ~4 characters per token for most models
    // For production, use proper tokenization libraries like tiktoken
    const estimatedTokens = Math.ceil(text.length / 4);
    
    // Apply model-specific adjustments
    const actualModel = model || this.defaultModel;
    const config = this.modelConfig.get(actualModel);
    
    if (config?.provider === 'anthropic') {
      // Anthropic typically has slightly different tokenization
      return Math.ceil(estimatedTokens * 1.1);
    }
    
    return estimatedTokens;
  }

  async generateSummary(text: string, maxLength: number = 100): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `Generate a concise summary of the following conversation in ${maxLength} words or less. Focus on the main topics and outcomes.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const result = await this.generateCompletion({
      messages,
      model: 'gpt-3.5-turbo', // Use cheaper model for summaries
      temperature: 0.3,
      maxTokens: Math.ceil(maxLength * 1.5), // Buffer for token estimation
    });

    return result.content.trim();
  }

  async generateTitle(content: string): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: 'Generate a short, descriptive title for this conversation in 5 words or less.',
      },
      {
        role: 'user',
        content: content,
      },
    ];

    const result = await this.generateCompletion({
      messages,
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 20,
    });

    return result.content.trim();
  }

  async classifyContent(content: string, categories: string[]): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `Classify the following content into one of these categories: ${categories.join(', ')}. Respond with only the category name.`,
      },
      {
        role: 'user',
        content,
      },
    ];

    const result = await this.generateCompletion({
      messages,
      model: 'gpt-3.5-turbo',
      temperature: 0.1,
      maxTokens: 10,
    });

    const classification = result.content.trim().toLowerCase();
    
    // Validate classification is in allowed categories
    const normalizedCategories = categories.map(c => c.toLowerCase());
    if (normalizedCategories.includes(classification)) {
      return categories[normalizedCategories.indexOf(classification)];
    }

    // Fallback to first category if classification is invalid
    return categories[0];
  }

  async extractKeywords(text: string, maxKeywords: number = 10): Promise<string[]> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `Extract up to ${maxKeywords} relevant keywords from the text. Return them as a comma-separated list.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const result = await this.generateCompletion({
      messages,
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      maxTokens: 100,
    });

    return result.content
      .split(',')
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0)
      .slice(0, maxKeywords);
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `Translate the following text to ${targetLanguage}. Maintain the original tone and meaning.`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    const result = await this.generateCompletion({
      messages,
      model: 'gpt-4o', // Use better model for translation
      temperature: 0.2,
      maxTokens: Math.ceil(text.length * 2), // Buffer for translation expansion
    });

    return result.content.trim();
  }

  calculateCost(tokenUsage: { promptTokens: number; completionTokens: number }, model: string): number {
    const config = this.modelConfig.get(model);
    if (!config?.costPer1kTokens) {
      return 0;
    }

    const inputCost = (tokenUsage.promptTokens / 1000) * config.costPer1kTokens.input;
    const outputCost = (tokenUsage.completionTokens / 1000) * config.costPer1kTokens.output;

    return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimal places
  }

  getAvailableModels(): Array<{ id: string; name: string; provider: string; maxTokens: number }> {
    return Array.from(this.modelConfig.entries()).map(([id, config]) => ({
      id,
      name: id,
      provider: config.provider,
      maxTokens: config.maxTokens,
    }));
  }

  async validateModelAccess(model: string, tenantId: string): Promise<boolean> {
    // Check if tenant has access to this model based on subscription
    // This would integrate with your subscription service
    const modelConfig = this.modelConfig.get(model);
    if (!modelConfig) {
      return false;
    }

    // For now, allow all models - implement proper access control based on subscription tiers
    return true;
  }

  async moderateContent(content: string): Promise<{
    flagged: boolean;
    categories: string[];
    scores: Record<string, number>;
  }> {
    try {
      if (this.openai) {
        const moderation = await this.openai.moderations.create({
          input: content,
        });

        const result = moderation.results[0];
        return {
          flagged: result.flagged,
          categories: Object.keys(result.categories).filter(
            key => result.categories[key as keyof typeof result.categories]
          ),
          scores: result.category_scores,
        };
      }

      // Fallback: no moderation
      return {
        flagged: false,
        categories: [],
        scores: {},
      };
    } catch (error) {
      console.error('Content moderation failed:', error);
      return {
        flagged: false,
        categories: [],
        scores: {},
      };
    }
  }
}