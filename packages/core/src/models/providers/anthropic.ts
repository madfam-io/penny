import Anthropic from '@anthropic-ai/sdk';
import type {
  ModelProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  Message,
  ModelError,
} from '../types.js';

export class AnthropicProvider implements ModelProvider {
  name = 'anthropic';
  type = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Anthropic doesn't have a list models endpoint, so we try a minimal request
      await this.client.messages.create({
        model: 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't provide a list models API, so we return known models
    const models = [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        contextLength: 200000,
        maxOutputTokens: 4096,
        inputCostPer1k: 0.015,
        outputCostPer1k: 0.075,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        contextLength: 200000,
        maxOutputTokens: 4096,
        inputCostPer1k: 0.003,
        outputCostPer1k: 0.015,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        contextLength: 200000,
        maxOutputTokens: 4096,
        inputCostPer1k: 0.00025,
        outputCostPer1k: 0.00125,
      },
    ];

    return models.map((model) => ({
      ...model,
      provider: this.name,
      capabilities: {
        chat: true,
        functionCalling: true,
        vision: true,
        streaming: true,
      },
    }));
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const systemMessage = request.messages.find((m) => m.role === 'system');
      const otherMessages = request.messages.filter((m) => m.role !== 'system');

      const response = await this.client.messages.create({
        model: request.model,
        messages: this.convertMessages(otherMessages),
        system: systemMessage?.content as string,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences: request.stop,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
      });

      return this.convertResponse(response, request.model);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *generateStream(request: CompletionRequest): AsyncGenerator<CompletionChunk> {
    try {
      const systemMessage = request.messages.find((m) => m.role === 'system');
      const otherMessages = request.messages.filter((m) => m.role !== 'system');

      const stream = await this.client.messages.create({
        model: request.model,
        messages: this.convertMessages(otherMessages),
        system: systemMessage?.content as string,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences: request.stop,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        stream: true,
      });

      for await (const chunk of stream) {
        yield this.convertChunk(chunk, request.model);
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((msg) => {
        if (msg.role === 'tool') {
          return {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: msg.toolCallId!,
                content: msg.content as string,
              },
            ],
          };
        }

        if (Array.isArray(msg.content)) {
          return {
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content.map((c) => {
              if (c.type === 'text') {
                return { type: 'text', text: c.text! };
              } else {
                return {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: c.image_url!.url.split(',')[1],
                  },
                };
              }
            }),
          };
        }

        return {
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content as string,
        };
      });
  }

  private convertTools(tools: any[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description || '',
      input_schema: tool.function.parameters || { type: 'object', properties: {} },
    }));
  }

  private convertResponse(response: Anthropic.Message, model: string): CompletionResponse {
    const toolCalls = response.content
      .filter((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use')
      .map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.input),
        },
      }));

    const textContent = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    return {
      id: response.id,
      object: 'chat.completion',
      created: Date.now() / 1000,
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finishReason:
            response.stop_reason === 'end_turn' ? 'stop' : (response.stop_reason as any),
        },
      ],
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  private convertChunk(chunk: any, model: string): CompletionChunk {
    const delta: any = {};

    if (chunk.type === 'message_start') {
      delta.role = 'assistant';
    } else if (chunk.type === 'content_block_delta') {
      if (chunk.delta.type === 'text_delta') {
        delta.content = chunk.delta.text;
      }
    }

    return {
      id: chunk.message?.id || 'stream',
      object: 'chat.completion.chunk',
      created: Date.now() / 1000,
      model,
      choices: [
        {
          index: 0,
          delta,
          finishReason: chunk.type === 'message_stop' ? 'stop' : null,
        },
      ],
    };
  }

  private handleError(error: any): ModelError {
    if (error instanceof Anthropic.APIError) {
      const retryable = error.status === 429 || error.status >= 500;
      return new ModelError(
        error.message,
        error.status?.toString() || 'api_error',
        this.name,
        undefined,
        retryable,
      );
    }
    return new ModelError(error.message || 'Unknown error', 'unknown_error', this.name);
  }
}
