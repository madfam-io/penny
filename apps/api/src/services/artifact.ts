import { prisma } from '@penny/database';
import { generateId } from '@penny/shared';
import { StorageService } from '@penny/core/storage';
import Redis from 'ioredis';

export interface CreateArtifactParams {
  type: 'dashboard' | 'chart' | 'table' | 'document' | 'image' | 'code';
  name: string;
  content: any;
  mimeType?: string;
  metadata?: Record<string, any>;
  conversationId?: string;
  messageId?: string;
  userId: string;
  tenantId: string;
}

export interface UpdateArtifactParams {
  name?: string;
  content?: any;
  metadata?: Record<string, any>;
}

export class ArtifactService {
  private storage: StorageService;
  private redis: Redis;

  constructor(storageConfig?: any, redisUrl?: string) {
    this.storage = new StorageService(
      storageConfig || {
        provider: process.env.STORAGE_PROVIDER || 'local',
        bucket: process.env.S3_BUCKET_NAME || 'penny-artifacts',
        endpoint: process.env.S3_ENDPOINT,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION || 'us-east-1',
      },
    );

    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async createArtifact(params: CreateArtifactParams) {
    const { type, name, content, mimeType, metadata, conversationId, messageId, userId, tenantId } =
      params;

    const artifactId = generateId('art');

    // Determine storage strategy based on artifact type and size
    let storageUrl: string | null = null;
    let storedContent = content;

    if (this.shouldStoreExternally(type, content)) {
      // Store large artifacts in object storage
      const fileName = `${tenantId}/${artifactId}/${name.toLowerCase().replace(/\s+/g, '-')}`;
      storageUrl = await this.storage.upload(fileName, content, {
        contentType: mimeType,
        metadata: {
          artifactId,
          tenantId,
          userId,
          type,
        },
      });

      // Store reference instead of content
      storedContent = {
        url: storageUrl,
        size: JSON.stringify(content).length,
      };
    }

    // Create database record
    const artifact = await prisma.artifact.create({
      data: {
        id: artifactId,
        tenantId,
        userId,
        conversationId,
        messageId,
        type,
        name,
        content: storedContent,
        mimeType: mimeType || this.getMimeType(type),
        storageUrl,
        metadata: metadata || {},
        version: 1,
      },
    });

    // Cache artifact metadata
    await this.cacheArtifact(artifact);

    // Emit event for real-time updates
    if (conversationId) {
      await this.redis.publish(
        `conversation:${conversationId}`,
        JSON.stringify({
          type: 'artifact.created',
          data: artifact,
        }),
      );
    }

    return artifact;
  }

  async getArtifact(artifactId: string, userId: string, tenantId: string) {
    // Try cache first
    const cached = await this.getCachedArtifact(artifactId);
    if (cached) return cached;

    const artifact = await prisma.artifact.findFirst({
      where: {
        id: artifactId,
        tenantId,
        OR: [{ userId }, { sharedWith: { some: { userId } } }],
      },
    });

    if (!artifact) {
      throw new Error('Artifact not found or access denied');
    }

    // Load external content if needed
    if (artifact.storageUrl) {
      const content = await this.storage.download(artifact.storageUrl);
      artifact.content = content;
    }

    // Cache for future requests
    await this.cacheArtifact(artifact);

    return artifact;
  }

  async updateArtifact(
    artifactId: string,
    params: UpdateArtifactParams,
    userId: string,
    tenantId: string,
  ) {
    // Verify ownership
    const existing = await prisma.artifact.findFirst({
      where: {
        id: artifactId,
        userId,
        tenantId,
      },
    });

    if (!existing) {
      throw new Error('Artifact not found or access denied');
    }

    // Handle content update
    let storageUrl = existing.storageUrl;
    let storedContent = params.content;

    if (params.content && this.shouldStoreExternally(existing.type, params.content)) {
      // Update external storage
      if (existing.storageUrl) {
        await this.storage.delete(existing.storageUrl);
      }

      const fileName = `${tenantId}/${artifactId}/${params.name || existing.name}`;
      storageUrl = await this.storage.upload(fileName, params.content, {
        contentType: existing.mimeType,
      });

      storedContent = {
        url: storageUrl,
        size: JSON.stringify(params.content).length,
      };
    }

    // Update database
    const artifact = await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        name: params.name,
        content: storedContent,
        storageUrl,
        metadata: params.metadata,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateArtifactCache(artifactId);

    // Emit update event
    if (existing.conversationId) {
      await this.redis.publish(
        `conversation:${existing.conversationId}`,
        JSON.stringify({
          type: 'artifact.updated',
          data: artifact,
        }),
      );
    }

    return artifact;
  }

  async deleteArtifact(artifactId: string, userId: string, tenantId: string) {
    const artifact = await prisma.artifact.findFirst({
      where: {
        id: artifactId,
        userId,
        tenantId,
      },
    });

    if (!artifact) {
      throw new Error('Artifact not found or access denied');
    }

    // Delete from external storage if needed
    if (artifact.storageUrl) {
      await this.storage.delete(artifact.storageUrl);
    }

    // Soft delete from database
    await prisma.artifact.update({
      where: { id: artifactId },
      data: { deletedAt: new Date() },
    });

    // Clear cache
    await this.invalidateArtifactCache(artifactId);

    // Emit delete event
    if (artifact.conversationId) {
      await this.redis.publish(
        `conversation:${artifact.conversationId}`,
        JSON.stringify({
          type: 'artifact.deleted',
          data: { id: artifactId },
        }),
      );
    }
  }

  async listArtifacts(
    userId: string,
    tenantId: string,
    options?: {
      conversationId?: string;
      type?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const { conversationId, type, limit = 20, offset = 0 } = options || {};

    const where: any = {
      tenantId,
      deletedAt: null,
      OR: [{ userId }, { sharedWith: { some: { userId } } }],
    };

    if (conversationId) {
      where.conversationId = conversationId;
    }

    if (type) {
      where.type = type;
    }

    const [artifacts, total] = await Promise.all([
      prisma.artifact.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          name: true,
          mimeType: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          version: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.artifact.count({ where }),
    ]);

    return { artifacts, total };
  }

  async shareArtifact(artifactId: string, shareWithUserId: string, ownerId: string) {
    await prisma.artifactShare.create({
      data: {
        artifactId,
        userId: shareWithUserId,
        sharedBy: ownerId,
        permissions: ['view', 'download'],
      },
    });

    // Notify shared user
    await this.redis.publish(
      `user:${shareWithUserId}`,
      JSON.stringify({
        type: 'artifact.shared',
        data: { artifactId, sharedBy: ownerId },
      }),
    );
  }

  async getArtifactVersions(artifactId: string, userId: string, tenantId: string) {
    // In production, implement version tracking
    const artifact = await this.getArtifact(artifactId, userId, tenantId);
    return [
      {
        version: artifact.version,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
      },
    ];
  }

  async generateSignedUrl(artifactId: string, userId: string, tenantId: string) {
    const artifact = await this.getArtifact(artifactId, userId, tenantId);

    if (!artifact.storageUrl) {
      throw new Error('Artifact has no external storage');
    }

    // Generate temporary signed URL
    const signedUrl = await this.storage.getSignedUrl(artifact.storageUrl, {
      expiresIn: 3600, // 1 hour
      operation: 'read',
    });

    return signedUrl;
  }

  // Helper methods
  private shouldStoreExternally(type: string, content: any): boolean {
    const contentSize = JSON.stringify(content).length;
    const threshold = 100 * 1024; // 100KB

    // Always store images and large content externally
    return type === 'image' || contentSize > threshold;
  }

  private getMimeType(type: string): string {
    const mimeTypes: Record<string, string> = {
      dashboard: 'application/vnd.penny.dashboard+json',
      chart: 'application/vnd.penny.chart+json',
      table: 'application/vnd.penny.table+json',
      document: 'text/html',
      image: 'image/png',
      code: 'text/plain',
    };

    return mimeTypes[type] || 'application/octet-stream';
  }

  // Cache management
  private async cacheArtifact(artifact: any) {
    const key = `artifact:${artifact.id}`;
    await this.redis.setex(key, 3600, JSON.stringify(artifact));
  }

  private async getCachedArtifact(artifactId: string) {
    const key = `artifact:${artifactId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  private async invalidateArtifactCache(artifactId: string) {
    const key = `artifact:${artifactId}`;
    await this.redis.del(key);
  }

  async disconnect() {
    await this.redis.disconnect();
  }
}
