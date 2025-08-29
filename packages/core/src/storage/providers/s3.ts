import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  StorageProvider,
  UploadFile,
  UploadOptions,
  StorageObject,
  DownloadOptions,
  UrlOptions,
  ListOptions,
} from '../types.js';

export interface S3StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

export class S3StorageProvider implements StorageProvider {
  name = 's3';
  private client: S3Client;
  private bucket: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
    });
  }

  async upload(file: UploadFile, options?: UploadOptions): Promise<StorageObject> {
    const key = options?.folder ? `${options.folder}/${file.filename}` : file.filename;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimeType,
      ContentLength: file.size,
      ACL: options?.acl,
      Metadata: options?.metadata,
      Tagging: options?.tags
        ? Object.entries(options.tags)
            .map(([k, v]) => `${k}=${v}`)
            .join('&')
        : undefined,
    });

    const response = await this.client.send(command);

    return {
      key,
      size: file.size,
      etag: response.ETag?.replace(/"/g, '') || '',
      lastModified: new Date(),
      contentType: file.mimeType,
      metadata: options?.metadata,
    };
  }

  async download(key: string, options?: DownloadOptions): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      VersionId: options?.version,
      Range: options?.range ? `bytes=${options.range.start}-${options.range.end}` : undefined,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('No body in response');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getUrl(key: string, options?: UrlOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: options?.download
        ? `attachment; filename="${options.filename || key}"`
        : undefined,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: options?.expiresIn || 3600,
    });
  }

  async list(prefix: string, options?: ListOptions): Promise<StorageObject[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: options?.maxKeys || 1000,
      ContinuationToken: options?.continuationToken,
      Delimiter: options?.delimiter,
    });

    const response = await this.client.send(command);

    return (response.Contents || []).map((obj) => ({
      key: obj.Key!,
      size: obj.Size!,
      etag: obj.ETag?.replace(/"/g, '') || '',
      lastModified: obj.LastModified!,
    }));
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destKey,
    });

    await this.client.send(command);
  }

  async move(sourceKey: string, destKey: string): Promise<void> {
    await this.copy(sourceKey, destKey);
    await this.delete(sourceKey);
  }
}
