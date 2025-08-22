import type { TenantId } from '@penny/shared';
import { prisma } from '@penny/database';
import { CryptoService } from '@penny/security';
import type {
  StorageProvider,
  StorageConfig,
  UploadFile,
  UploadOptions,
  StorageObject,
  DownloadOptions,
  UrlOptions,
  ListOptions,
} from './types.js';
import { LocalStorageProvider } from './providers/local.js';
import { S3StorageProvider } from './providers/s3.js';
import { generateId } from '@penny/shared';
import * as path from 'path';
import { createHash } from 'crypto';

export class StorageService {
  private provider: StorageProvider;
  private crypto: CryptoService;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.crypto = new CryptoService();

    // Initialize provider based on config
    switch (config.provider) {
      case 'local':
        this.provider = new LocalStorageProvider(config.local!);
        break;
      case 's3':
        this.provider = new S3StorageProvider(config.s3!);
        break;
      default:
        throw new Error(`Unsupported storage provider: ${config.provider}`);
    }
  }

  async upload(
    file: UploadFile,
    options: UploadOptions,
  ): Promise<StorageObject> {
    // Validate file
    this.validateFile(file);

    // Generate storage key
    const key = this.generateKey(file.filename, options);

    // Encrypt if enabled
    let uploadBuffer = file.buffer;
    if (this.config.encryption?.enabled && options.encryption !== false) {
      uploadBuffer = Buffer.from(
        await this.crypto.encrypt(
          file.buffer.toString('base64'),
          options.tenantId,
        ),
      );
    }

    // Upload file
    const storageObject = await this.provider.upload(
      {
        ...file,
        buffer: uploadBuffer,
      },
      {
        ...options,
        metadata: {
          ...options.metadata,
          originalName: file.filename,
          tenantId: options.tenantId,
          userId: options.userId || '',
          encrypted: String(this.config.encryption?.enabled || false),
        },
      },
    );

    // Store file record in database
    await this.storeFileRecord(storageObject, file, options);

    return storageObject;
  }

  async download(
    key: string,
    tenantId: TenantId,
    options?: DownloadOptions,
  ): Promise<Buffer> {
    // Check access permissions
    const file = await prisma.file.findFirst({
      where: {
        storageKey: key,
        tenantId,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Download file
    let buffer = await this.provider.download(key, options);

    // Decrypt if encrypted
    if (file.encrypted) {
      const decrypted = await this.crypto.decrypt(
        buffer.toString(),
        tenantId,
      );
      buffer = Buffer.from(decrypted, 'base64');
    }

    return buffer;
  }

  async delete(key: string, tenantId: TenantId): Promise<void> {
    // Check access permissions
    const file = await prisma.file.findFirst({
      where: {
        storageKey: key,
        tenantId,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Delete from storage
    await this.provider.delete(key);

    // Mark as deleted in database
    await prisma.file.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });
  }

  async getUrl(
    key: string,
    tenantId: TenantId,
    options?: UrlOptions,
  ): Promise<string> {
    // Check access permissions
    const file = await prisma.file.findFirst({
      where: {
        storageKey: key,
        tenantId,
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Don't provide direct URLs for encrypted files
    if (file.encrypted) {
      // Return a proxied URL that goes through our API
      return `/api/v1/files/${file.id}/download`;
    }

    return this.provider.getUrl(key, options);
  }

  async list(
    prefix: string,
    tenantId: TenantId,
    options?: ListOptions,
  ): Promise<StorageObject[]> {
    // Build tenant-specific prefix
    const tenantPrefix = `tenants/${tenantId}/${prefix}`;
    
    // List from storage
    const objects = await this.provider.list(tenantPrefix, options);

    // Filter based on database records for access control
    const keys = objects.map(obj => obj.key);
    const files = await prisma.file.findMany({
      where: {
        storageKey: { in: keys },
        tenantId,
        deletedAt: null,
      },
    });

    const allowedKeys = new Set(files.map(f => f.storageKey));
    return objects.filter(obj => allowedKeys.has(obj.key));
  }

  private validateFile(file: UploadFile): void {
    const limits = this.config.limits;
    if (!limits) return;

    // Check file size
    if (limits.maxFileSize && file.size > limits.maxFileSize) {
      throw new Error(
        `File size ${file.size} exceeds maximum of ${limits.maxFileSize}`,
      );
    }

    // Check mime type
    if (limits.allowedMimeTypes && 
        !limits.allowedMimeTypes.includes(file.mimeType)) {
      throw new Error(
        `File type ${file.mimeType} is not allowed`,
      );
    }

    // Check extension
    const ext = path.extname(file.filename).toLowerCase();
    if (limits.blockedExtensions && 
        limits.blockedExtensions.includes(ext)) {
      throw new Error(
        `File extension ${ext} is blocked`,
      );
    }
  }

  private generateKey(
    filename: string,
    options: UploadOptions,
  ): string {
    const ext = path.extname(filename);
    const hash = createHash('sha256')
      .update(filename + Date.now())
      .digest('hex')
      .substring(0, 8);

    const parts = [
      'tenants',
      options.tenantId,
      options.folder || 'files',
      new Date().getFullYear(),
      String(new Date().getMonth() + 1).padStart(2, '0'),
      `${generateId('file')}_${hash}${ext}`,
    ];

    return parts.join('/');
  }

  private async storeFileRecord(
    storageObject: StorageObject,
    file: UploadFile,
    options: UploadOptions,
  ): Promise<void> {
    await prisma.file.create({
      data: {
        tenantId: options.tenantId,
        userId: options.userId,
        filename: file.filename,
        storageKey: storageObject.key,
        mimeType: file.mimeType,
        size: file.size,
        encrypted: this.config.encryption?.enabled || false,
        metadata: {
          etag: storageObject.etag,
          contentType: storageObject.contentType,
          ...options.metadata,
        },
      },
    });
  }
}