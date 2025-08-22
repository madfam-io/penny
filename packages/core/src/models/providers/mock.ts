import type {
  ModelProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
} from '../types.js';

export class MockProvider implements ModelProvider {
  name = 'mock';
  type = 'local' as const;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'mock-gpt-3.5',
        name: 'Mock GPT-3.5',
        provider: this.name,
        contextLength: 4096,
        maxOutputTokens: 4096,
        inputCostPer1k: 0,
        outputCostPer1k: 0,
        capabilities: {
          chat: true,
          functionCalling: true,
          vision: false,
          streaming: true,
        },
      },
      {
        id: 'mock-gpt-4',
        name: 'Mock GPT-4',
        provider: this.name,
        contextLength: 8192,
        maxOutputTokens: 4096,
        inputCostPer1k: 0,
        outputCostPer1k: 0,
        capabilities: {
          chat: true,
          functionCalling: true,
          vision: true,
          streaming: true,
        },
      },
    ];
  }

  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const lastMessage = request.messages[request.messages.length - 1];
    let responseContent = `Mock response to: "${lastMessage.content}"`;
    
    // Handle tool calls
    if (request.tools && request.tools.length > 0) {
      const toolCall = {
        id: `call_${Date.now()}`,
        type: 'function' as const,
        function: {
          name: request.tools[0].function.name,
          arguments: JSON.stringify({ mock: true }),
        },
      };

      return {
        id: `mock_${Date.now()}`,
        object: 'chat.completion',
        created: Date.now() / 1000,
        model: request.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [toolCall],
          },
          finishReason: 'tool_calls',
        }],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
    }

    return {
      id: `mock_${Date.now()}`,
      object: 'chat.completion',
      created: Date.now() / 1000,
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseContent,
        },
        finishReason: 'stop',
      }],
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    };
  }

  async *generateStream(request: CompletionRequest): AsyncGenerator<CompletionChunk> {
    const words = ['This', 'is', 'a', 'mock', 'streaming', 'response', 'from', 'the', 'AI', 'assistant.'];
    
    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      yield {
        id: `mock_stream_${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Date.now() / 1000,
        model: request.model,
        choices: [{
          index: 0,
          delta: {
            content: word + ' ',
          },
          finishReason: null,
        }],
      };
    }

    yield {
      id: `mock_stream_${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Date.now() / 1000,
      model: request.model,
      choices: [{
        index: 0,
        delta: {},
        finishReason: 'stop',
      }],
    };
  }
}