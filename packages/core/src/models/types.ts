import type { z } from 'zod';

export interface ModelProvider {
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'local';
  isAvailable(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
  generateCompletion(request: CompletionRequest): Promise<CompletionResponse>;
  generateStream(request: CompletionRequest): AsyncGenerator<CompletionChunk>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  maxOutputTokens?: number;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
  capabilities: ModelCapabilities;
}

export interface ModelCapabilities {
  chat: boolean;
  functionCalling: boolean;
  vision: boolean;
  streaming: boolean;
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'text' | 'json_object' };
  seed?: number;
  user?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessageContent[];
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: z.ZodSchema<any> | Record<string, any>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage?: Usage;
  systemFingerprint?: string;
}

export interface Choice {
  index: number;
  message: Message;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChunkChoice[];
}

export interface ChunkChoice {
  index: number;
  delta: Partial<Message>;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface ModelRoutingPolicy {
  defaultModel: string;
  fallbackModels: string[];
  rules: RoutingRule[];
}

export interface RoutingRule {
  condition: RoutingCondition;
  model: string;
  priority: number;
}

export interface RoutingCondition {
  type: 'complexity' | 'language' | 'capability' | 'cost' | 'latency';
  operator: 'eq' | 'gt' | 'lt' | 'contains' | 'matches';
  value: any;
}

export class ModelError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public model?: string,
    public retryable = false,
  ) {
    super(message);
    this.name = 'ModelError';
  }
}
