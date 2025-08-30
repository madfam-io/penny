import { Job, Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { AIService } from '../services/AIService';
import { ToolService } from '../services/ToolService';
import { ArtifactService } from '../services/ArtifactService';
import { UsageService } from '../services/UsageService';
import { WebhookService } from '../services/WebhookService';

interface ProcessMessageJobData {
  conversationId: string;
  messageId: string;
  tenantId: string;
  userId: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  toolsEnabled?: string[];
  artifactsEnabled?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}

interface ProcessMessageJobResult {
  success: boolean;
  messageId?: string;
  assistantMessageId?: string;
  artifactsCreated?: string[];
  toolsExecuted?: string[];
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  error?: string;
}

export class ProcessMessageJob {
  private prisma: PrismaClient;
  private aiService: AIService;
  private toolService: ToolService;
  private artifactService: ArtifactService;
  private usageService: UsageService;
  private webhookService: WebhookService;
  private queue: Queue;
  private worker: Worker;

  constructor(redisConnection: any) {
    this.prisma = new PrismaClient();
    this.aiService = new AIService();
    this.toolService = new ToolService();
    this.artifactService = new ArtifactService();
    this.usageService = new UsageService();
    this.webhookService = new WebhookService();

    // Initialize queue
    this.queue = new Queue('message-processing', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Initialize worker
    this.worker = new Worker(
      'message-processing',
      this.processJob.bind(this),
      {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 jobs concurrently
        limiter: {
          max: 10, // Maximum 10 jobs per interval
          duration: 60000, // per 60 seconds
        },
      }
    );

    this.setupEventHandlers();
  }

  async addJob(data: ProcessMessageJobData, options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }): Promise<Job<ProcessMessageJobData, ProcessMessageJobResult>> {
    return this.queue.add('process-message', data, {
      jobId: options?.jobId || `msg-${data.messageId}`,
      priority: options?.priority || 0,
      delay: options?.delay || 0,
    });
  }

  private async processJob(
    job: Job<ProcessMessageJobData, ProcessMessageJobResult>
  ): Promise<ProcessMessageJobResult> {
    const { data } = job;
    
    try {
      job.updateProgress(0);
      
      // Verify message and conversation exist
      const message = await this.prisma.message.findUnique({
        where: { id: data.messageId },
        include: {
          conversation: {
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
                take: 50, // Get context messages
              },
            },
          },
        },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      job.updateProgress(10);

      // Skip processing if not a user message
      if (data.role !== 'user') {
        return {
          success: true,
          messageId: data.messageId,
        };
      }

      // Get conversation context
      const context = this.buildConversationContext(message.conversation.messages);
      
      job.updateProgress(20);

      // Prepare tools if enabled
      let availableTools: any[] = [];
      if (data.toolsEnabled && data.toolsEnabled.length > 0) {
        availableTools = await this.toolService.getToolsForExecution(
          data.toolsEnabled,
          data.tenantId
        );
      }

      job.updateProgress(30);

      // Generate AI response
      const completion = await this.aiService.generateCompletion({
        messages: context,
        model: data.model,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        tools: availableTools,
      });

      job.updateProgress(50);

      // Create assistant message
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId: data.conversationId,
          userId: null, // Assistant message
          role: 'assistant',
          content: completion.content,
          toolCalls: completion.toolCalls,
          tokenCount: completion.tokenUsage.completionTokens,
          metadata: {
            model: data.model,
            temperature: data.temperature,
            promptTokens: completion.tokenUsage.promptTokens,
            completionTokens: completion.tokenUsage.completionTokens,
          },
        },
      });

      job.updateProgress(60);

      // Execute tool calls if any
      const toolsExecuted: string[] = [];
      if (completion.toolCalls && completion.toolCalls.length > 0) {
        for (const toolCall of completion.toolCalls) {
          try {
            const result = await this.toolService.executeTool({
              name: toolCall.function.name,
              parameters: JSON.parse(toolCall.function.arguments),
              tenantId: data.tenantId,
              userId: data.userId,
              conversationId: data.conversationId,
            });

            // Create tool result message
            await this.prisma.message.create({
              data: {
                conversationId: data.conversationId,
                userId: data.userId,
                role: 'tool',
                content: JSON.stringify(result),
                parentMessageId: assistantMessage.id,
                metadata: {
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                },
              },
            });

            toolsExecuted.push(toolCall.function.name);
          } catch (error) {
            console.error(`Tool execution failed: ${toolCall.function.name}`, error);
          }
        }
      }

      job.updateProgress(70);

      // Generate artifacts if enabled and applicable
      const artifactsCreated: string[] = [];
      if (data.artifactsEnabled && this.shouldGenerateArtifacts(completion.content)) {
        try {
          const artifacts = await this.generateArtifacts(
            data.conversationId,
            assistantMessage.id,
            completion.content,
            data.tenantId,
            data.userId
          );
          artifactsCreated.push(...artifacts);
        } catch (error) {
          console.error('Artifact generation failed', error);
        }
      }

      job.updateProgress(80);

      // Record usage metrics
      await this.recordUsage(data, completion);

      // Calculate cost
      const cost = this.aiService.calculateCost(
        completion.tokenUsage,
        data.model || 'gpt-4-turbo-preview'
      );

      job.updateProgress(90);

      // Trigger webhooks
      await this.triggerWebhooks(data, {
        messageId: data.messageId,
        assistantMessageId: assistantMessage.id,
        toolsExecuted,
        artifactsCreated,
        tokenUsage: completion.tokenUsage,
        cost,
      });

      job.updateProgress(100);

      return {
        success: true,
        messageId: data.messageId,
        assistantMessageId: assistantMessage.id,
        artifactsCreated,
        toolsExecuted,
        tokenUsage: completion.tokenUsage,
        cost,
      };

    } catch (error) {
      console.error('Message processing failed:', error);
      
      // Update message with error status
      await this.prisma.message.update({
        where: { id: data.messageId },
        data: {
          metadata: {
            ...data.metadata,
            error: error.message,
            processingFailed: true,
            failedAt: new Date().toISOString(),
          },
        },
      });

      return {
        success: false,
        messageId: data.messageId,
        error: error.message,
      };
    }
  }

  private buildConversationContext(messages: any[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      ...(msg.toolCalls && { tool_calls: msg.toolCalls }),
    }));
  }

  private shouldGenerateArtifacts(content: string): boolean {
    // Simple heuristics to determine if artifacts should be generated
    const artifactTriggers = [
      'create a chart',
      'generate a graph',
      'make a diagram',
      'build a dashboard',
      'create a visualization',
      'show me a table',
      'generate html',
      'create css',
      'write code',
    ];

    return artifactTriggers.some(trigger => 
      content.toLowerCase().includes(trigger)
    );
  }

  private async generateArtifacts(
    conversationId: string,
    messageId: string,
    content: string,
    tenantId: string,
    userId: string
  ): Promise<string[]> {
    const artifacts: string[] = [];

    // Extract code blocks
    const codeBlockRegex = /```(\w+)?
([\s\S]*?)```/g;
    let match;
    let index = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();

      if (code.length > 50) { // Only create artifacts for substantial code
        try {
          const artifact = await this.artifactService.createArtifact({
            tenantId,
            userId,
            conversationId,
            messageId,
            type: this.getArtifactType(language),
            name: `Generated ${language} code ${index + 1}`,
            content: { code, language },
            mimeType: this.getMimeType(language),
          });

          artifacts.push(artifact.id);
          index++;
        } catch (error) {
          console.error('Failed to create artifact:', error);
        }
      }
    }

    return artifacts;
  }

  private getArtifactType(language: string): string {
    const typeMap: Record<string, string> = {
      html: 'html',
      css: 'css',
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      json: 'json',
      markdown: 'markdown',
    };

    return typeMap[language] || 'code';
  }

  private getMimeType(language: string): string {
    const mimeMap: Record<string, string> = {
      html: 'text/html',
      css: 'text/css',
      javascript: 'application/javascript',
      typescript: 'application/typescript',
      python: 'text/x-python',
      json: 'application/json',
      markdown: 'text/markdown',
    };

    return mimeMap[language] || 'text/plain';
  }

  private async recordUsage(
    data: ProcessMessageJobData,
    completion: any
  ): Promise<void> {
    // Record message usage
    await this.usageService.recordUsage({
      tenantId: data.tenantId,
      userId: data.userId,
      resourceType: 'messages',
      resourceId: data.conversationId,
      quantity: 1,
      unit: 'count',
      metadata: {
        messageId: data.messageId,
        role: data.role,
      },
    });

    // Record token usage
    await this.usageService.recordUsage({
      tenantId: data.tenantId,
      userId: data.userId,
      resourceType: 'tokens',
      resourceId: data.messageId,
      quantity: completion.tokenUsage.totalTokens,
      unit: 'tokens',
      cost: this.aiService.calculateCost(completion.tokenUsage, data.model || 'gpt-4-turbo-preview'),
      metadata: {
        model: data.model,
        promptTokens: completion.tokenUsage.promptTokens,
        completionTokens: completion.tokenUsage.completionTokens,
      },
    });
  }

  private async triggerWebhooks(
    data: ProcessMessageJobData,
    result: Partial<ProcessMessageJobResult>
  ): Promise<void> {
    try {
      await this.webhookService.triggerEvent(data.tenantId, 'message.processed', {
        conversationId: data.conversationId,
        messageId: data.messageId,
        userId: data.userId,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Webhook trigger failed:', error);
    }
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Message processing job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Message processing job ${job?.id} failed:`, err.message);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`Message processing job ${jobId} stalled`);
    });
  }

  // Queue management methods
  async getQueueStatus() {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  async clearQueue() {
    await this.queue.clean(0, 0);
    await this.queue.empty();
  }

  async pauseQueue() {
    await this.queue.pause();
  }

  async resumeQueue() {
    await this.queue.resume();
  }

  async shutdown() {
    await this.worker.close();
    await this.queue.close();
    await this.prisma.$disconnect();
  }
}