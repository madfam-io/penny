import { Artifact, ArtifactCollection } from '@penny/types';\nimport { ArtifactQueryOptions } from './ArtifactService';

export interface ShareToken {
  artifactId: string;
  token: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface StorageConfig {
  provider: 'local' | 's3' | 'r2';
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  basePath?: string;
}

export class ArtifactStorageService {
  private artifacts: Map<string, Artifact> = new Map();
  private collections: Map<string, ArtifactCollection> = new Map();
  private shareTokens: Map<string, ShareToken> = new Map();

  constructor(private config: StorageConfig) {
    // Initialize storage based on configuration
    this.initializeStorage();
  }

  async store(artifact: Artifact): Promise<Artifact> {
    // Store content externally if it's large or binary
    const processedArtifact = await this.processContent(artifact);
    
    // Store metadata in database
    this.artifacts.set(artifact.id, processedArtifact);
    
    return processedArtifact;
  }

  async findById(id: string): Promise<Artifact | null> {
    const artifact = this.artifacts.get(id);
    
    if (!artifact) {
      return null;
    }

    // Load content from external storage if needed
    return await this.loadContent(artifact);
  }

  async findMany(options: ArtifactQueryOptions): Promise<{ artifacts: Artifact[]; total: number }> {
    let artifacts = Array.from(this.artifacts.values());

    // Filter by tenant
    artifacts = artifacts.filter(a => a.tenantId === options.tenantId);

    // Apply filters
    if (options.userId) {
      artifacts = artifacts.filter(a => a.createdBy === options.userId);
    }

    if (options.conversationId) {
      artifacts = artifacts.filter(a => a.conversationId === options.conversationId);
    }

    if (options.type && options.type.length > 0) {
      artifacts = artifacts.filter(a => options.type!.includes(a.type));
    }

    if (options.tags && options.tags.length > 0) {
      artifacts = artifacts.filter(a => 
        options.tags!.some(tag => a.tags.includes(tag))
      );
    }

    if (options.isPublic !== undefined) {
      artifacts = artifacts.filter(a => a.isPublic === options.isPublic);
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      artifacts = artifacts.filter(a => 
        a.title.toLowerCase().includes(searchLower) ||
        (a.description && a.description.toLowerCase().includes(searchLower)) ||
        a.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    const total = artifacts.length;

    // Sort
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    
    artifacts.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'size':
          aVal = a.size || 0;
          bVal = b.size || 0;
          break;
        case 'updatedAt':
          aVal = a.updatedAt.getTime();
          bVal = b.updatedAt.getTime();
          break;
        default: // createdAt
          aVal = a.createdAt.getTime();
          bVal = b.createdAt.getTime();
      }

      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Paginate
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    artifacts = artifacts.slice(offset, offset + limit);

    // Load content for each artifact
    const artifactsWithContent = await Promise.all(
      artifacts.map(a => this.loadContent(a))
    );

    return { artifacts: artifactsWithContent, total };
  }

  async update(id: string, artifact: Artifact): Promise<Artifact> {
    if (!this.artifacts.has(id)) {
      throw new Error('Artifact not found');
    }

    // Process content for storage
    const processedArtifact = await this.processContent(artifact);
    
    // Update in storage
    this.artifacts.set(id, processedArtifact);
    
    return processedArtifact;
  }

  async delete(id: string): Promise<boolean> {
    const artifact = this.artifacts.get(id);
    
    if (!artifact) {
      return false;
    }

    // Delete external content if exists
    await this.deleteContent(artifact);
    
    // Delete from metadata storage
    this.artifacts.delete(id);
    
    return true;
  }

  async search(query: string, options: Partial<ArtifactQueryOptions>): Promise<{ artifacts: Artifact[]; total: number }> {
    return await this.findMany({
      tenantId: options.tenantId!,
      search: query,
      ...options
    });
  }

  async createShareToken(data: Omit<ShareToken, 'createdAt' | 'isActive'>): Promise<ShareToken> {
    const shareToken: ShareToken = {
      ...data,
      createdAt: new Date(),
      isActive: true
    };

    this.shareTokens.set(data.token, shareToken);
    return shareToken;
  }

  async getSharedArtifact(token: string): Promise<Artifact | null> {
    const shareToken = this.shareTokens.get(token);
    
    if (!shareToken || !shareToken.isActive || shareToken.expiresAt < new Date()) {
      return null;
    }

    return await this.findById(shareToken.artifactId);
  }

  async revokeShareToken(token: string): Promise<boolean> {
    const shareToken = this.shareTokens.get(token);
    
    if (!shareToken) {
      return false;
    }

    shareToken.isActive = false;
    this.shareTokens.set(token, shareToken);
    
    return true;
  }

  async getCollections(tenantId: string, userId?: string): Promise<ArtifactCollection[]> {
    let collections = Array.from(this.collections.values());
    
    // Filter by tenant
    collections = collections.filter(c => c.tenantId === tenantId);
    
    // Filter by user if specified
    if (userId) {
      collections = collections.filter(c => c.createdBy === userId);
    }

    return collections;
  }

  async createCollection(collection: ArtifactCollection): Promise<ArtifactCollection> {
    this.collections.set(collection.id, collection);
    return collection;
  }

  async addToCollection(collectionId: string, artifactId: string, tenantId: string): Promise<boolean> {
    const collection = this.collections.get(collectionId);
    
    if (!collection || collection.tenantId !== tenantId) {
      return false;
    }

    if (!collection.artifacts.includes(artifactId)) {
      collection.artifacts.push(artifactId);
      collection.updatedAt = new Date();
      this.collections.set(collectionId, collection);
    }

    return true;
  }

  async removeFromCollection(collectionId: string, artifactId: string, tenantId: string): Promise<boolean> {
    const collection = this.collections.get(collectionId);
    
    if (!collection || collection.tenantId !== tenantId) {
      return false;
    }

    const index = collection.artifacts.indexOf(artifactId);
    if (index > -1) {
      collection.artifacts.splice(index, 1);
      collection.updatedAt = new Date();
      this.collections.set(collectionId, collection);
    }

    return true;
  }

  async getAnalytics(tenantId: string, options?: { since?: Date; until?: Date }) {
    const artifacts = Array.from(this.artifacts.values())
      .filter(a => a.tenantId === tenantId);

    let filteredArtifacts = artifacts;
    
    if (options?.since) {
      filteredArtifacts = filteredArtifacts.filter(a => a.createdAt >= options.since!);
    }
    
    if (options?.until) {
      filteredArtifacts = filteredArtifacts.filter(a => a.createdAt <= options.until!);
    }

    const totalArtifacts = filteredArtifacts.length;
    const totalSize = filteredArtifacts.reduce((sum, a) => sum + (a.size || 0), 0);
    
    const typeDistribution = filteredArtifacts.reduce((acc, artifact) => {
      acc[artifact.type] = (acc[artifact.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tagUsage = filteredArtifacts.reduce((acc, artifact) => {
      artifact.tags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const createdByUser = filteredArtifacts.reduce((acc, artifact) => {
      acc[artifact.createdBy] = (acc[artifact.createdBy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalArtifacts,
      totalSize,
      averageSize: totalArtifacts > 0 ? totalSize / totalArtifacts : 0,
      typeDistribution,
      tagUsage,
      createdByUser,
      timeRange: {
        from: options?.since || new Date(Math.min(...filteredArtifacts.map(a => a.createdAt.getTime()))),
        to: options?.until || new Date(Math.max(...filteredArtifacts.map(a => a.createdAt.getTime())))
      }
    };
  }

  private async initializeStorage(): Promise<void> {
    switch (this.config.provider) {
      case 's3':
        await this.initializeS3();
        break;
      case 'r2':
        await this.initializeR2();
        break;
      case 'local':
      default:
        await this.initializeLocal();
        break;
    }
  }

  private async initializeS3(): Promise<void> {
    // Initialize AWS S3 client
    console.log('Initializing S3 storage...');
  }

  private async initializeR2(): Promise<void> {
    // Initialize Cloudflare R2 client
    console.log('Initializing R2 storage...');
  }

  private async initializeLocal(): Promise<void> {
    // Initialize local file system storage
    console.log('Initializing local storage...');
  }

  private async processContent(artifact: Artifact): Promise<Artifact> {
    // For large content or binary data, store externally and keep reference
    const contentSize = this.calculateContentSize(artifact.content);
    
    if (contentSize > 1024 * 1024) { // 1MB threshold
      const contentUrl = await this.storeContentExternally(artifact);
      return {
        ...artifact,
        url: contentUrl,
        content: { type: 'external', url: contentUrl }
      };
    }

    return artifact;
  }

  private async loadContent(artifact: Artifact): Promise<Artifact> {
    if (artifact.content && typeof artifact.content === 'object' && artifact.content.type === 'external') {
      const externalContent = await this.loadContentExternally(artifact.content.url);
      return {
        ...artifact,
        content: externalContent
      };
    }

    return artifact;
  }

  private async storeContentExternally(artifact: Artifact): Promise<string> {
    // Mock external storage
    const key = `artifacts/${artifact.id}/${Date.now()}`;
    
    switch (this.config.provider) {
      case 's3':
      case 'r2':
        // Upload to cloud storage\n        return `${this.config.endpoint}/${this.config.bucket}/${key}`;
      case 'local':
      default:
        // Store locally\n        return `/storage/${key}`;
    }
  }

  private async loadContentExternally(url: string): Promise<any> {
    // Mock loading from external storage
    // In real implementation, would fetch from S3/R2/local storage
    return null;
  }

  private async deleteContent(artifact: Artifact): Promise<void> {
    if (artifact.url) {
      // Delete from external storage\n      console.log(`Deleting external content: ${artifact.url}`);
    }
  }

  private calculateContentSize(content: any): number {
    if (typeof content === 'string') {
      return Buffer.byteLength(content, 'utf8');
    }
    return Buffer.byteLength(JSON.stringify(content), 'utf8');
  }
}