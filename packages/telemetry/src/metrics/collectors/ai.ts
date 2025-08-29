import { getMetrics } from '../metrics.js';

export interface AIMetricsOptions {
  includeModel?: boolean;
  includeProvider?: boolean;
  includeTenant?: boolean;
}

export function createAIMetricsCollector(options: AIMetricsOptions = {}) {
  const metrics = getMetrics();

  // Create metrics
  const completionDuration = metrics.histogram(
    'ai_completion_duration_milliseconds',
    'Duration of AI completions in milliseconds',
    [100, 250, 500, 1000, 2500, 5000, 10000, 25000],
  );

  const completionTokens = metrics.counter(
    'ai_completion_tokens_total',
    'Total number of tokens used in completions',
  );

  const completionCost = metrics.counter(
    'ai_completion_cost_cents',
    'Total cost of AI completions in cents',
  );

  const completionErrors = metrics.counter(
    'ai_completion_errors_total',
    'Total number of AI completion errors',
  );

  const streamingChunks = metrics.counter(
    'ai_streaming_chunks_total',
    'Total number of streaming chunks sent',
  );

  const toolExecutions = metrics.counter(
    'ai_tool_executions_total',
    'Total number of tool executions',
  );

  const activeCompletions = metrics.gauge(
    'ai_active_completions',
    'Number of active AI completions',
  );

  return {
    startCompletion(model: string, provider: string, tenantId?: string) {
      activeCompletions.increment();

      const startTime = Date.now();

      return {
        recordSuccess(
          promptTokens: number,
          completionTokens: number,
          totalTokens: number,
          costCents: number,
          chunksCount = 0,
        ) {
          const duration = Date.now() - startTime;
          const tags: Record<string, string> = {};

          if (options.includeModel) {
            tags.model = model;
          }

          if (options.includeProvider) {
            tags.provider = provider;
          }

          if (options.includeTenant && tenantId) {
            tags.tenant_id = tenantId;
          }

          // Record metrics
          completionDuration.observe(duration, { tags });
          completionTokens.increment(totalTokens, {
            tags: { ...tags, token_type: 'total' },
          });
          completionTokens.increment(promptTokens, {
            tags: { ...tags, token_type: 'prompt' },
          });
          completionTokens.increment(completionTokens, {
            tags: { ...tags, token_type: 'completion' },
          });
          completionCost.increment(costCents, { tags });

          if (chunksCount > 0) {
            streamingChunks.increment(chunksCount, { tags });
          }

          activeCompletions.decrement();
        },

        recordError(error: Error) {
          const duration = Date.now() - startTime;
          const tags: Record<string, string> = {
            error_type: error.name,
          };

          if (options.includeModel) {
            tags.model = model;
          }

          if (options.includeProvider) {
            tags.provider = provider;
          }

          completionErrors.increment(1, { tags });
          completionDuration.observe(duration, { tags });
          activeCompletions.decrement();
        },

        recordToolExecution(toolName: string, success: boolean) {
          const tags: Record<string, string> = {
            tool: toolName,
            success: String(success),
          };

          if (options.includeModel) {
            tags.model = model;
          }

          toolExecutions.increment(1, { tags });
        },
      };
    },

    recordEmbedding(
      model: string,
      provider: string,
      tokens: number,
      costCents: number,
      tenantId?: string,
    ) {
      const tags: Record<string, string> = {};

      if (options.includeModel) {
        tags.model = model;
      }

      if (options.includeProvider) {
        tags.provider = provider;
      }

      if (options.includeTenant && tenantId) {
        tags.tenant_id = tenantId;
      }

      metrics.counter('ai_embedding_tokens_total').increment(tokens, { tags });
      metrics.counter('ai_embedding_cost_cents').increment(costCents, { tags });
    },
  };
}
