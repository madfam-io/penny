import { 
  ArtifactVersion, 
  VersionComparison, 
  VersionBranch, 
  MergeRequest, 
  RollbackOperation,
  VersionHistoryOptions,
  VersionAnalytics
} from '@penny/types';

export class ArtifactVersionService {
  private versions: Map<string, ArtifactVersion[]> = new Map();
  private branches: Map<string, VersionBranch[]> = new Map();
  private mergeRequests: Map<string, MergeRequest[]> = new Map();
  private rollbackOperations: Map<string, RollbackOperation[]> = new Map();

  async createVersion(version: Omit<ArtifactVersion, 'id' | 'checksum'>): Promise<ArtifactVersion> {
    const versionData: ArtifactVersion = {
      ...version,
      id: this.generateId(),
      checksum: this.calculateChecksum(version.content),
      size: this.calculateSize(version.content)
    };

    const artifactVersions = this.versions.get(version.artifactId) || [];
    artifactVersions.push(versionData);
    this.versions.set(version.artifactId, artifactVersions);

    return versionData;
  }

  async getVersion(artifactId: string, version: number): Promise<ArtifactVersion | null> {
    const versions = this.versions.get(artifactId) || [];
    return versions.find(v => v.version === version) || null;
  }

  async getVersionHistory(
    artifactId: string, 
    options: VersionHistoryOptions = {}
  ): Promise<ArtifactVersion[]> {
    let versions = this.versions.get(artifactId) || [];

    // Apply filters
    if (options.since) {
      versions = versions.filter(v => v.createdAt >= options.since!);
    }

    if (options.until) {
      versions = versions.filter(v => v.createdAt <= options.until!);
    }

    if (options.branch) {
      versions = versions.filter(v => v.branchName === options.branch);
    }

    if (options.author) {
      versions = versions.filter(v => v.createdBy === options.author);
    }

    if (options.tags && options.tags.length > 0) {
      versions = versions.filter(v => 
        options.tags!.some(tag => v.tags.includes(tag))
      );
    }

    if (options.status) {
      versions = versions.filter(v => v.status === options.status);
    }

    // Sort by version number (descending)
    versions.sort((a, b) => b.version - a.version);

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 10;
    versions = versions.slice(offset, offset + limit);

    // Remove content if not requested
    if (!options.includeContent) {
      versions = versions.map(v => ({ ...v, content: undefined }));
    }

    // Remove metadata if not requested
    if (!options.includeMetadata) {
      versions = versions.map(v => ({ ...v, metadata: undefined }));
    }

    return versions;
  }

  async compareVersions(
    artifactId: string, 
    fromVersion: number, 
    toVersion: number
  ): Promise<VersionComparison | null> {
    const fromVer = await this.getVersion(artifactId, fromVersion);
    const toVer = await this.getVersion(artifactId, toVersion);

    if (!fromVer || !toVer) {
      return null;
    }

    const differences = this.calculateDifferences(fromVer.content, toVer.content);
    const similarity = this.calculateSimilarity(fromVer.content, toVer.content);

    return {
      fromVersion,
      toVersion,
      differences,
      summary: {
        added: differences.filter(d => d.type === 'added').length,
        modified: differences.filter(d => d.type === 'modified').length,
        removed: differences.filter(d => d.type === 'removed').length,
        similarity
      },
      metadata: {
        comparedAt: new Date(),
        algorithm: 'json-diff',
        options: {}
      }
    };
  }

  async deleteVersions(artifactId: string): Promise<boolean> {
    this.versions.delete(artifactId);
    this.branches.delete(artifactId);
    this.mergeRequests.delete(artifactId);
    this.rollbackOperations.delete(artifactId);
    return true;
  }

  async createBranch(
    artifactId: string,
    branchData: Omit<VersionBranch, 'id' | 'createdAt'>
  ): Promise<VersionBranch> {
    const branch: VersionBranch = {
      ...branchData,
      id: this.generateId(),
      createdAt: new Date()
    };

    const artifactBranches = this.branches.get(artifactId) || [];
    artifactBranches.push(branch);
    this.branches.set(artifactId, artifactBranches);

    return branch;
  }

  async getBranches(artifactId: string): Promise<VersionBranch[]> {
    return this.branches.get(artifactId) || [];
  }

  async mergeBranch(
    artifactId: string,
    sourceBranch: string,
    targetBranch: string,
    userId: string
  ): Promise<MergeRequest> {
    const mergeRequest: MergeRequest = {
      id: this.generateId(),
      artifactId,
      sourceBranch,
      targetBranch,
      title: `Merge ${sourceBranch} into ${targetBranch}`,
      status: 'open',
      createdAt: new Date(),
      createdBy: userId,
      assignees: [],
      reviewers: [],
      changes: [], // Would calculate actual changes
      conflicts: [] // Would detect merge conflicts
    };

    const artifactMergeRequests = this.mergeRequests.get(artifactId) || [];
    artifactMergeRequests.push(mergeRequest);
    this.mergeRequests.set(artifactId, artifactMergeRequests);

    return mergeRequest;
  }

  async getMergeRequests(artifactId: string): Promise<MergeRequest[]> {
    return this.mergeRequests.get(artifactId) || [];
  }

  async createRollbackOperation(operation: RollbackOperation): Promise<RollbackOperation> {
    const artifactRollbacks = this.rollbackOperations.get(operation.artifactId) || [];
    artifactRollbacks.push(operation);
    this.rollbackOperations.set(operation.artifactId, artifactRollbacks);

    return operation;
  }

  async getRollbackOperations(artifactId: string): Promise<RollbackOperation[]> {
    return this.rollbackOperations.get(artifactId) || [];
  }

  async getVersionAnalytics(artifactId: string): Promise<VersionAnalytics> {
    const versions = this.versions.get(artifactId) || [];
    const branches = this.branches.get(artifactId) || [];
    const mergeRequests = this.mergeRequests.get(artifactId) || [];

    const contributors = [...new Set(versions.map(v => v.createdBy))];
    const totalSize = versions.reduce((sum, v) => sum + (v.size || 0), 0);
    const averageSize = versions.length > 0 ? totalSize / versions.length : 0;

    // Calculate version frequency
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyVersions = versions.filter(v => v.createdAt >= dayAgo).length;
    const weeklyVersions = versions.filter(v => v.createdAt >= weekAgo).length;
    const monthlyVersions = versions.filter(v => v.createdAt >= monthAgo).length;

    return {
      artifactId,
      totalVersions: versions.length,
      totalSize,
      averageSize,
      versionFrequency: {
        daily: dailyVersions,
        weekly: weeklyVersions,
        monthly: monthlyVersions
      },
      contributors: contributors.map(userId => {
        const userVersions = versions.filter(v => v.createdBy === userId);
        return {
          userId,
          versions: userVersions.length,
          firstContribution: new Date(Math.min(...userVersions.map(v => v.createdAt.getTime()))),
          lastContribution: new Date(Math.max(...userVersions.map(v => v.createdAt.getTime())))
        };
      }),
      branches: {
        total: branches.length,
        active: branches.filter(b => b.status === 'active').length,
        merged: branches.filter(b => b.status === 'merged').length,
        closed: branches.filter(b => b.status === 'closed').length
      },
      mergeRequests: {
        total: mergeRequests.length,
        open: mergeRequests.filter(mr => mr.status === 'open').length,
        merged: mergeRequests.filter(mr => mr.status === 'merged').length,
        closed: mergeRequests.filter(mr => mr.status === 'closed').length,
        averageReviewTime: this.calculateAverageReviewTime(mergeRequests)
      },
      storage: {
        totalSize,
        compressedSize: Math.floor(totalSize * 0.7), // Mock compression
        compressionRatio: 0.7
      }
    };
  }

  private calculateDifferences(oldContent: any, newContent: any): any[] {
    const differences: any[] = [];

    // Simple object comparison (would use a proper diff library in production)
    if (typeof oldContent === 'object' && typeof newContent === 'object') {
      const oldKeys = Object.keys(oldContent || {});
      const newKeys = Object.keys(newContent || {});

      // Added keys
      newKeys.forEach(key => {
        if (!oldKeys.includes(key)) {
          differences.push({
            type: 'added',
            path: key,
            newValue: newContent[key]
          });
        }
      });

      // Removed keys
      oldKeys.forEach(key => {
        if (!newKeys.includes(key)) {
          differences.push({
            type: 'removed',
            path: key,
            oldValue: oldContent[key]
          });
        }
      });

      // Modified keys
      oldKeys.forEach(key => {
        if (newKeys.includes(key) && JSON.stringify(oldContent[key]) !== JSON.stringify(newContent[key])) {
          differences.push({
            type: 'modified',
            path: key,
            oldValue: oldContent[key],
            newValue: newContent[key]
          });
        }
      });
    } else if (oldContent !== newContent) {
      differences.push({
        type: 'modified',\n        path: '/',
        oldValue: oldContent,
        newValue: newContent
      });
    }

    return differences;
  }

  private calculateSimilarity(oldContent: any, newContent: any): number {
    // Simple similarity calculation (would use a proper algorithm in production)
    const oldStr = JSON.stringify(oldContent || '');
    const newStr = JSON.stringify(newContent || '');

    if (oldStr === newStr) return 1;
    if (oldStr === '' || newStr === '') return 0;

    const maxLength = Math.max(oldStr.length, newStr.length);
    let matches = 0;

    for (let i = 0; i < Math.min(oldStr.length, newStr.length); i++) {
      if (oldStr[i] === newStr[i]) matches++;
    }

    return matches / maxLength;
  }

  private calculateAverageReviewTime(mergeRequests: MergeRequest[]): number | undefined {
    const completedMRs = mergeRequests.filter(mr => 
      (mr.status === 'merged' || mr.status === 'closed') && 
      mr.mergedAt && 
      mr.createdAt
    );

    if (completedMRs.length === 0) return undefined;

    const totalReviewTime = completedMRs.reduce((sum, mr) => {
      const reviewTime = (mr.mergedAt!.getTime() - mr.createdAt.getTime()) / (1000 * 60 * 60); // hours
      return sum + reviewTime;
    }, 0);

    return totalReviewTime / completedMRs.length;
  }

  private calculateChecksum(content: any): string {
    // Simple checksum calculation (would use crypto.createHash in production)
    const str = JSON.stringify(content);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private calculateSize(content: any): number {
    if (typeof content === 'string') {
      return Buffer.byteLength(content, 'utf8');
    }
    return Buffer.byteLength(JSON.stringify(content), 'utf8');
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}"