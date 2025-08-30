import { Artifact, ArtifactAction, ArtifactCollection, ArtifactSchema } from '@penny/types';\nimport { ArtifactStorageService } from './ArtifactStorageService';\nimport { ArtifactVersionService } from './ArtifactVersionService';\nimport { ArtifactProcessingService } from './ArtifactProcessingService';

export interface ArtifactQueryOptions {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  type?: string[];
  tags?: string[];
  isPublic?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'size';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface ArtifactCreateData {
  title: string;
  description?: string;
  type: Artifact['type'];
  content: any;
  metadata?: Record<string, any>;
  conversationId?: string;
  messageId?: string;
  tags?: string[];
  isPublic?: boolean;
  tenantId: string;
  createdBy: string;
}

export interface ArtifactUpdateData {
  title?: string;
  description?: string;
  content?: any;
  metadata?: Record<string, any>;
  tags?: string[];
  isPublic?: boolean;
}

export class ArtifactService {
  constructor(
    private storageService: ArtifactStorageService,
    private versionService: ArtifactVersionService,
    private processingService: ArtifactProcessingService
  ) {}

  async create(data: ArtifactCreateData): Promise<Artifact> {
    // Validate artifact data
    const validatedData = ArtifactSchema.parse({
      ...data,
      id: this.generateId(),
      version: 1,
      size: this.calculateSize(data.content),
      exportFormats: this.getExportFormats(data.type),
      createdAt: new Date(),
      updatedAt: new Date(),
      exportFormats: []
    });

    // Process content based on type
    const processedArtifact = await this.processingService.processArtifact(validatedData);

    // Store artifact
    const artifact = await this.storageService.store(processedArtifact);

    // Create initial version
    await this.versionService.createVersion({
      artifactId: artifact.id,
      version: 1,
      title: artifact.title,
      description: artifact.description,
      content: artifact.content,
      metadata: artifact.metadata,
      changes: [
        {
          type: 'added',\n          path: '/',
          newValue: artifact,
          description: 'Initial version'
        }
      ],
      createdAt: new Date(),
      createdBy: artifact.createdBy,
      status: 'published'
    });

    // Log creation action
    await this.logAction({
      type: 'create',
      artifactId: artifact.id,
      userId: artifact.createdBy,
      timestamp: new Date(),
      metadata: {
        type: artifact.type,
        size: artifact.size
      }
    });

    return artifact;
  }

  async findById(id: string, tenantId: string): Promise<Artifact | null> {
    const artifact = await this.storageService.findById(id);
    
    if (!artifact || artifact.tenantId !== tenantId) {
      return null;
    }

    return artifact;
  }

  async findMany(options: ArtifactQueryOptions): Promise<{ artifacts: Artifact[]; total: number }> {
    const { artifacts, total } = await this.storageService.findMany(options);
    return { artifacts, total };
  }

  async update(id: string, data: ArtifactUpdateData, userId: string, tenantId: string): Promise<Artifact | null> {
    const existing = await this.findById(id, tenantId);
    if (!existing) {
      throw new Error('Artifact not found');
    }

    // Calculate changes
    const changes = this.calculateChanges(existing, data);
    
    // Update artifact
    const updatedArtifact = {
      ...existing,
      ...data,
      version: existing.version + 1,
      updatedAt: new Date()
    };

    // Validate updated data
    const validatedArtifact = ArtifactSchema.parse(updatedArtifact);

    // Process updated content if needed
    const processedArtifact = await this.processingService.processArtifact(validatedArtifact);

    // Store updated artifact
    const artifact = await this.storageService.update(id, processedArtifact);

    // Create new version
    if (changes.length > 0) {
      await this.versionService.createVersion({
        artifactId: artifact.id,
        version: artifact.version,
        title: artifact.title,
        description: artifact.description,
        content: artifact.content,
        metadata: artifact.metadata,
        changes,
        createdAt: new Date(),
        createdBy: userId,
        parentVersion: existing.version,
        status: 'published'
      });
    }

    // Log update action
    await this.logAction({
      type: 'update',
      artifactId: artifact.id,
      userId,
      timestamp: new Date(),
      data: { changes: changes.length },
      metadata: { previousVersion: existing.version }
    });

    return artifact;
  }

  async delete(id: string, userId: string, tenantId: string): Promise<boolean> {
    const artifact = await this.findById(id, tenantId);
    if (!artifact) {
      return false;
    }

    // Delete from storage
    const deleted = await this.storageService.delete(id);
    
    if (deleted) {
      // Delete versions
      await this.versionService.deleteVersions(id);

      // Log deletion action
      await this.logAction({
        type: 'delete',
        artifactId: id,
        userId,
        timestamp: new Date(),
        metadata: {
          title: artifact.title,
          type: artifact.type
        }
      });
    }

    return deleted;
  }

  async share(id: string, userId: string, tenantId: string): Promise<{ shareUrl: string; expiresAt: Date } | null> {
    const artifact = await this.findById(id, tenantId);
    if (!artifact) {
      return null;
    }

    const shareToken = this.generateShareToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store share token (would be stored in database)
    await this.storageService.createShareToken({
      artifactId: id,
      token: shareToken,
      createdBy: userId,
      expiresAt
    });

    // Log share action
    await this.logAction({
      type: 'share',
      artifactId: id,
      userId,
      timestamp: new Date(),
      metadata: { expiresAt }
    });

    return {
      shareUrl: `/shared/${shareToken}`,
      expiresAt
    };
  }

  async export(id: string, format: string, userId: string, tenantId: string): Promise<Buffer | null> {
    const artifact = await this.findById(id, tenantId);
    if (!artifact) {
      return null;
    }

    if (!artifact.exportFormats.includes(format)) {\n      throw new Error(`Export format ${format} not supported for this artifact type`);
    }

    // Generate export
    const exportData = await this.processingService.exportArtifact(artifact, format);

    // Log export action
    await this.logAction({
      type: 'export',
      artifactId: id,
      userId,
      timestamp: new Date(),
      data: { format },
      metadata: { size: exportData.length }
    });

    return exportData;
  }

  async getVersions(id: string, tenantId: string): Promise<any[]> {
    const artifact = await this.findById(id, tenantId);
    if (!artifact) {
      return [];
    }

    return await this.versionService.getVersionHistory(id);
  }

  async restoreVersion(id: string, version: number, userId: string, tenantId: string): Promise<Artifact | null> {
    const artifact = await this.findById(id, tenantId);
    if (!artifact) {
      return null;
    }

    const versionData = await this.versionService.getVersion(id, version);
    if (!versionData) {
      throw new Error('Version not found');
    }

    // Create rollback operation
    await this.versionService.createRollbackOperation({
      id: this.generateId(),
      artifactId: id,
      fromVersion: artifact.version,
      toVersion: version,
      reason: 'Manual restore',
      createdAt: new Date(),
      createdBy: userId,
      status: 'pending'
    });

    // Restore artifact to version state
    const restoredArtifact = await this.update(id, {
      title: versionData.title,
      description: versionData.description,
      content: versionData.content,
      metadata: versionData.metadata
    }, userId, tenantId);

    return restoredArtifact;
  }

  async search(query: string, options: Partial<ArtifactQueryOptions>): Promise<{ artifacts: Artifact[]; total: number }> {
    return await this.storageService.search(query, options);
  }

  async getCollections(tenantId: string, userId?: string): Promise<ArtifactCollection[]> {
    return await this.storageService.getCollections(tenantId, userId);
  }

  async createCollection(data: Omit<ArtifactCollection, 'id' | 'createdAt' | 'updatedAt'>): Promise<ArtifactCollection> {
    const collection = {
      ...data,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.storageService.createCollection(collection);
  }

  async addToCollection(collectionId: string, artifactId: string, tenantId: string): Promise<boolean> {
    return await this.storageService.addToCollection(collectionId, artifactId, tenantId);
  }

  async removeFromCollection(collectionId: string, artifactId: string, tenantId: string): Promise<boolean> {
    return await this.storageService.removeFromCollection(collectionId, artifactId, tenantId);
  }

  async getAnalytics(tenantId: string, options?: { since?: Date; until?: Date }): Promise<any> {
    return await this.storageService.getAnalytics(tenantId, options);
  }

  private calculateSize(content: any): number {
    if (typeof content === 'string') {
      return Buffer.byteLength(content, 'utf8');
    }
    return Buffer.byteLength(JSON.stringify(content), 'utf8');
  }

  private getExportFormats(type: string): string[] {
    const formatMap: Record<string, string[]> = {
      chart: ['png', 'svg', 'pdf', 'json'],
      table: ['csv', 'excel', 'pdf', 'json'],
      code: ['txt', 'pdf'],
      markdown: ['html', 'pdf', 'txt'],
      image: ['png', 'jpg', 'webp'],
      json: ['json', 'txt', 'csv'],
      html: ['html', 'pdf'],
      video: ['mp4', 'webm'],
      audio: ['mp3', 'wav'],
      pdf: ['pdf'],
      map: ['png', 'svg', 'pdf', 'json'],
      model: ['obj', 'stl', 'glb']
    };
    return formatMap[type] || ['json'];
  }

  private calculateChanges(existing: Artifact, updates: ArtifactUpdateData): any[] {
    const changes: any[] = [];

    if (updates.title && updates.title !== existing.title) {
      changes.push({
        type: 'modified',\n        path: '/title',
        oldValue: existing.title,
        newValue: updates.title
      });
    }

    if (updates.content && JSON.stringify(updates.content) !== JSON.stringify(existing.content)) {
      changes.push({
        type: 'modified',\n        path: '/content',
        oldValue: existing.content,
        newValue: updates.content
      });
    }

    if (updates.metadata) {
      Object.keys(updates.metadata).forEach(key => {
        if (updates.metadata![key] !== existing.metadata?.[key]) {
          changes.push({
            type: 'modified',\n            path: `/metadata/${key}`,
            oldValue: existing.metadata?.[key],
            newValue: updates.metadata![key]
          });
        }
      });
    }

    return changes;
  }

  private async logAction(action: Omit<ArtifactAction, 'id'>): Promise<void> {
    // In a real implementation, this would store to a database
    console.log('Artifact action logged:', action);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private generateShareToken(): string {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }
}