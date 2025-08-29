import OpenAI from 'openai';
import type {
  ModelProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  Message,
  Tool,
  ModelError,
} from '../types.js';

export class OpenAIProvider implements ModelProvider {
  name = 'openai';
  type = 'openai' as const;
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const models = await this.client.models.list();

    return models.data
      .filter((model) => model.id.includes('gpt'))
      .map((model) => ({
        id: model.id,
        name: model.id,
        provider: this.name,
        contextLength: this.getContextLength(model.id),
        maxOutputTokens: this.getMaxOutputTokens(model.id),
        inputCostPer1k: this.getInputCost(model.id),
        outputCostPer1k: this.getOutputCost(model.id),
        capabilities: {
          chat: true,
          functionCalling: true,
          vision: model.id.includes('vision') || model.id.includes('4'),
          streaming: true,
        },
      }));
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: request.model,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stop: request.stop,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        tool_choice: request.toolChoice,
        response_format: request.responseFormat,
        seed: request.seed,
        user: request.user,
      });

      return this.convertResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async *generateStream(request: CompletionRequest): AsyncGenerator<CompletionChunk> {
    try {
      const stream = await this.client.chat.completions.create({
        model: request.model,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stop: request.stop,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        tool_choice: request.toolChoice,
        response_format: request.responseFormat,
        seed: request.seed,
        user: request.user,
        stream: true,
      });

      for await (const chunk of stream) {
        yield this.convertChunk(chunk);
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private convertMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content as string,
          tool_call_id: msg.toolCallId!,
        };
      }

      if (msg.toolCalls) {
        return {
          role: msg.role as any,
          content: msg.content as string,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: tc.type,
            function: tc.function,
          })),
        };
      }

      return {
        role: msg.role as any,
        content: msg.content,
        name: msg.name,
      };
    });
  }

  private convertTools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: tool.type,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  private convertResponse(response: OpenAI.Chat.ChatCompletion): CompletionResponse {
    return {
      id: response.id,
      object: response.object,
      created: response.created,
      model: response.model,
      choices: response.choices.map((choice) => ({
        index: choice.index,
        message: {
          role: choice.message.role,
          content: choice.message.content || '',
          toolCalls: choice.message.tool_calls?.map((tc) => ({
            id: tc.id,
            type: tc.type,
            function: tc.function,
          })),
        },
        finishReason: choice.finish_reason as any,
      })),
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      systemFingerprint: response.system_fingerprint || undefined,
    };
  }

  private convertChunk(chunk: OpenAI.Chat.ChatCompletionChunk): CompletionChunk {
    return {
      id: chunk.id,
      object: chunk.object,
      created: chunk.created,
      model: chunk.model,
      choices: chunk.choices.map((choice) => ({
        index: choice.index,
        delta: {
          role: choice.delta.role as any,
          content: choice.delta.content,
          toolCalls: choice.delta.tool_calls?.map((tc) => ({
            id: tc.id!,
            type: tc.type!,
            function: tc.function!,
          })),
        },
        finishReason: choice.finish_reason as any,
      })),
    };
  }

  private handleError(error: any): ModelError {
    if (error instanceof OpenAI.APIError) {
      const retryable = error.status === 429 || error.status >= 500;
      return new ModelError(
        error.message,
        error.type || 'api_error',
        this.name,
        undefined,
        retryable,
      );
    }
    return new ModelError(error.message || 'Unknown error', 'unknown_error', this.name);
  }

  private getContextLength(model: string): number {
    const contextLengths: Record<string, number> = {
      'gpt-4-turbo-preview': 128000,
      'gpt-4-1106-preview': 128000,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-3.5-turbo': 16385,
      'gpt-3.5-turbo-16k': 16385,
    };
    return contextLengths[model] || 4096;
  }

  private getMaxOutputTokens(model: string): number {
    if (model.includes('gpt-4')) return 4096;
    return 4096;
  }

  private getInputCost(model: string): number {
    const costs: Record<string, number> = {
      'gpt-4-turbo-preview': 0.01,
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.0005,
    };
    return costs[model] || 0;
  }

  private getOutputCost(model: string): number {
    const costs: Record<string, number> = {
      'gpt-4-turbo-preview': 0.03,
      'gpt-4': 0.06,
      'gpt-3.5-turbo': 0.0015,
    };
    return costs[model] || 0;
  }
}
