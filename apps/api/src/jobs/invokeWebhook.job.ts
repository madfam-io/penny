import { Job, Worker, Queue } from 'bullmq';\nimport { PrismaClient } from '@prisma/client';
import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';

interface InvokeWebhookJobData {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  attempt?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface InvokeWebhookJobResult {
  success: boolean;
  deliveryId: string;
  httpStatus?: number;
  response?: string;
  responseHeaders?: Record<string, string>;
  error?: string;
  retryAfter?: number;
  deliveredAt?: string;
}

export class InvokeWebhookJob {
  private prisma: PrismaClient;
  private queue: Queue;
  private worker: Worker;

  constructor(redisConnection: any) {
    this.prisma = new PrismaClient();

    // Initialize queue
    this.queue = new Queue('webhook-delivery', {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 1000, // Keep more completed jobs for debugging
        removeOnFail: 100,
        attempts: 1, // We handle retries manually
        delay: 0,
      },
    });

    // Initialize worker
    this.worker = new Worker(
      'webhook-delivery',
      this.processJob.bind(this),
      {
        connection: redisConnection,
        concurrency: 10, // Higher concurrency for webhooks
        limiter: {
          max: 50, // Maximum 50 webhook calls per interval
          duration: 60000, // per 60 seconds
        },
      }
    );

    this.setupEventHandlers();
  }

  async addJob(
    data: InvokeWebhookJobData,
    options?: {
      delay?: number;
      priority?: number;
      jobId?: string;
    }
  ): Promise<Job<InvokeWebhookJobData, InvokeWebhookJobResult>> {
    return this.queue.add('invoke-webhook', data, {
      jobId: options?.jobId || `webhook-${data.webhookId}-${Date.now()}`,
      delay: options?.delay || 0,
      priority: options?.priority || 0,
    });
  }

  private async processJob(
    job: Job<InvokeWebhookJobData, InvokeWebhookJobResult>
  ): Promise<InvokeWebhookJobResult> {
    const { data } = job;
    const startTime = Date.now();

    try {
      job.updateProgress(0);

      // Get webhook configuration
      const webhook = await this.prisma.webhook.findUnique({
        where: { id: data.webhookId },
      });

      if (!webhook) {
        throw new Error('Webhook not found');
      }

      if (!webhook.isActive) {
        throw new Error('Webhook is inactive');
      }

      job.updateProgress(10);

      // Create delivery record
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookId: data.webhookId,
          event: data.event,
          payload: data.payload,
          headers: data.headers || {},
          status: 'pending',
          attempt: data.attempt || 1,
        },
      });

      job.updateProgress(20);

      // Prepare request
      const requestPayload = {
        id: crypto.randomUUID(),
        event: data.event,
        timestamp: new Date().toISOString(),
        data: data.payload,
        webhook: {
          id: webhook.id,
          url: webhook.url,
        },
      };

      // Generate signature
      const signature = this.generateSignature(
        JSON.stringify(requestPayload),
        webhook.secret
      );

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Penny-Webhooks/1.0',
        'X-Penny-Signature': signature,
        'X-Penny-Event': data.event,
        'X-Penny-Delivery': delivery.id,
        ...data.headers,
      };

      job.updateProgress(30);

      // Make HTTP request
      let response: AxiosResponse;
      let responseTime: number;

      try {
        const requestStart = Date.now();
        
        response = await axios({
          method: 'POST',
          url: webhook.url,
          data: requestPayload,
          headers,
          timeout: webhook.timeout || 30000,
          validateStatus: () => true, // Don't throw on any status code
          maxRedirects: 3,
        });

        responseTime = Date.now() - requestStart;
        
        job.updateProgress(70);

      } catch (error) {
        responseTime = Date.now() - startTime;
        
        // Handle network/timeout errors
        const errorMessage = error.code === 'ECONNABORTED' 
          ? 'Request timeout'
          : error.message || 'Network error';

        await this.updateDelivery(delivery.id, {
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        });

        // Schedule retry if within limits
        if (this.shouldRetry(data.attempt || 1, webhook.maxRetries)) {
          await this.scheduleRetry(data, webhook, error.message);
        }

        return {
          success: false,
          deliveryId: delivery.id,
          error: errorMessage,
          retryAfter: this.calculateRetryDelay(data.attempt || 1, webhook.retryInterval),
        };
      }

      job.updateProgress(80);

      // Process response
      const isSuccess = response.status >= 200 && response.status < 300;
      const responseBody = typeof response.data === 'string' 
        ? response.data.substring(0, 10000) // Limit response body size
        : JSON.stringify(response.data).substring(0, 10000);

      // Update delivery record
      await this.updateDelivery(delivery.id, {
        status: isSuccess ? 'delivered' : 'failed',
        httpStatus: response.status,
        response: responseBody,\n        error: isSuccess ? null : `HTTP ${response.status}`,
        deliveredAt: isSuccess ? new Date() : null,
        completedAt: new Date(),
      });

      job.updateProgress(90);

      // Update webhook last triggered time
      if (isSuccess) {
        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: { lastTriggeredAt: new Date() },
        });
      }

      // Schedule retry if failed and within limits
      if (!isSuccess && this.shouldRetry(data.attempt || 1, webhook.maxRetries)) {\n        await this.scheduleRetry(data, webhook, `HTTP ${response.status}`);
      }

      job.updateProgress(100);

      return {
        success: isSuccess,
        deliveryId: delivery.id,
        httpStatus: response.status,
        response: responseBody,
        responseHeaders: response.headers,
        deliveredAt: isSuccess ? new Date().toISOString() : undefined,
        ...(isSuccess ? {} : { \n          error: `HTTP ${response.status}`,
          retryAfter: this.shouldRetry(data.attempt || 1, webhook.maxRetries)
            ? this.calculateRetryDelay(data.attempt || 1, webhook.retryInterval)
            : undefined,
        }),
      };

    } catch (error) {
      console.error('Webhook job processing failed:', error);

      // Try to update delivery if we have the ID\n      const deliveryId = `webhook-${data.webhookId}-${Date.now()}`;
      
      try {
        await this.prisma.webhookDelivery.create({
          data: {
            webhookId: data.webhookId,
            event: data.event,
            payload: data.payload,
            headers: data.headers || {},
            status: 'failed',
            attempt: data.attempt || 1,
            error: error.message,
            completedAt: new Date(),
          },
        });
      } catch (dbError) {
        console.error('Failed to create delivery record:', dbError);
      }

      return {
        success: false,
        deliveryId,
        error: error.message,
      };
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  private shouldRetry(currentAttempt: number, maxRetries: number): boolean {
    return currentAttempt < maxRetries;
  }

  private calculateRetryDelay(attempt: number, baseInterval: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = baseInterval * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, 300000); // Max 5 minutes
  }

  private async scheduleRetry(
    originalData: InvokeWebhookJobData,
    webhook: any,
    error: string
  ): Promise<void> {
    const nextAttempt = (originalData.attempt || 1) + 1;
    const retryDelay = this.calculateRetryDelay(nextAttempt, webhook.retryInterval);

    // Update delivery record with next retry time
    await this.prisma.webhookDelivery.updateMany({
      where: {
        webhookId: originalData.webhookId,
        event: originalData.event,
        attempt: originalData.attempt || 1,
      },
      data: {
        nextRetryAt: new Date(Date.now() + retryDelay),
      },
    });

    // Schedule retry job
    await this.addJob(
      {
        ...originalData,
        attempt: nextAttempt,
      },
      {
        delay: retryDelay,\n        jobId: `webhook-${originalData.webhookId}-${nextAttempt}-${Date.now()}`,
      }
    );
  }

  private async updateDelivery(
    deliveryId: string,
    updates: {
      status?: string;
      httpStatus?: number;
      response?: string;
      error?: string | null;
      deliveredAt?: Date | null;
      completedAt?: Date;
      nextRetryAt?: Date;
    }
  ): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: updates,
    });
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {\n      console.log(`Webhook job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {\n      console.error(`Webhook job ${job?.id} failed:`, err.message);
    });

    this.worker.on('stalled', (jobId) => {\n      console.warn(`Webhook job ${jobId} stalled`);
    });

    this.worker.on('error', (err) => {
      console.error('Webhook worker error:', err);
    });
  }

  // Webhook management methods
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

  async retryFailedDeliveries(webhookId?: string, maxAge?: number): Promise<number> {
    const where: any = {
      status: 'failed',
    };

    if (webhookId) {
      where.webhookId = webhookId;
    }

    if (maxAge) {
      where.createdAt = {
        gte: new Date(Date.now() - maxAge),
      };
    }

    const failedDeliveries = await this.prisma.webhookDelivery.findMany({
      where,
      include: {
        webhook: {
          select: {
            id: true,
            maxRetries: true,
            retryInterval: true,
            isActive: true,
          },
        },
      },
    });

    let retriedCount = 0;

    for (const delivery of failedDeliveries) {
      if (!delivery.webhook.isActive) {
        continue;
      }

      if (delivery.attempt >= delivery.webhook.maxRetries) {
        continue;
      }

      await this.addJob({
        webhookId: delivery.webhookId,
        event: delivery.event,
        payload: delivery.payload as Record<string, unknown>,
        headers: delivery.headers as Record<string, string>,
        attempt: delivery.attempt + 1,
      });

      retriedCount++;
    }

    return retriedCount;
  }

  async cleanupOldDeliveries(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge);

    const result = await this.prisma.webhookDelivery.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        status: {
          in: ['delivered', 'failed'],
        },
      },
    });

    return result.count;
  }

  async testWebhook(webhookId: string, event: string = 'test'): Promise<InvokeWebhookJobResult> {
    const testPayload = {
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString(),
      test: true,
    };

    const job = await this.addJob({
      webhookId,
      event,
      payload: testPayload,
    });

    // Wait for job completion
    return new Promise((resolve, reject) => {
      const checkJob = async () => {
        const jobState = await job.getState();
        
        if (jobState === 'completed') {
          const result = job.returnvalue;
          resolve(result);
        } else if (jobState === 'failed') {
          const error = job.failedReason;
          reject(new Error(error));
        } else {
          // Check again in 100ms
          setTimeout(checkJob, 100);
        }
      };

      checkJob();
    });
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