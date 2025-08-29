import type { TenantId } from '@penny/shared';

export interface StorageProvider {
  name: string;
  upload(file: UploadFile, options?: UploadOptions): Promise<StorageObject>;
  download(key: string, options?: DownloadOptions): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getUrl(key: string, options?: UrlOptions): Promise<string>;
  list(prefix: string, options?: ListOptions): Promise<StorageObject[]>;
  copy(sourceKey: string, destKey: string): Promise<void>;
  move(sourceKey: string, destKey: string): Promise<void>;
}

export interface UploadFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export interface UploadOptions {
  tenantId: TenantId;
  userId?: string;
  folder?: string;
  acl?: 'private' | 'public-read';
  metadata?: Record<string, string>;
  encryption?: boolean;
  tags?: Record<string, string>;
}

export interface DownloadOptions {
  version?: string;
  range?: { start: number; end: number };
}

export interface UrlOptions {
  expiresIn?: number; // seconds
  download?: boolean;
  filename?: string;
}

export interface ListOptions {
  maxKeys?: number;
  continuationToken?: string;
  delimiter?: string;
}

export interface StorageObject {
  key: string;
  size: number;
  etag: string;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
  url?: string;
}

export interface StorageConfig {
  provider: 'local' | 's3' | 'gcs' | 'azure';
  local?: {
    basePath: string;
    baseUrl: string;
  };
  s3?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
  gcs?: {
    bucket: string;
    projectId: string;
    keyFilename?: string;
  };
  azure?: {
    containerName: string;
    accountName: string;
    accountKey: string;
  };
  encryption?: {
    enabled: boolean;
    algorithm?: string;
  };
  limits?: {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
    blockedExtensions?: string[];
  };
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 500,
    public details?: any,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
