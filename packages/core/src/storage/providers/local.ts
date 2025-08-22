import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream } from 'fs';
import type {
  StorageProvider,
  UploadFile,
  UploadOptions,
  StorageObject,
  DownloadOptions,
  UrlOptions,
  ListOptions,
} from '../types.js';
import { createHash } from 'crypto';

export interface LocalStorageConfig {
  basePath: string;
  baseUrl: string;
}

export class LocalStorageProvider implements StorageProvider {
  name = 'local';
  private basePath: string;
  private baseUrl: string;

  constructor(config: LocalStorageConfig) {
    this.basePath = config.basePath;
    this.baseUrl = config.baseUrl;
  }

  async upload(
    file: UploadFile,
    options?: UploadOptions,
  ): Promise<StorageObject> {
    const key = options?.folder 
      ? path.join(options.folder, file.filename)
      : file.filename;
    
    const fullPath = path.join(this.basePath, key);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, file.buffer);

    // Calculate etag
    const etag = createHash('md5')
      .update(file.buffer)
      .digest('hex');

    return {
      key,
      size: file.size,
      etag,
      lastModified: new Date(),
      contentType: file.mimeType,
      metadata: options?.metadata,
    };
  }

  async download(
    key: string,
    options?: DownloadOptions,
  ): Promise<Buffer> {
    const fullPath = path.join(this.basePath, key);

    if (options?.range) {
      // Read partial content
      const { start, end } = options.range;
      const stream = createReadStream(fullPath, { start, end });
      const chunks: Buffer[] = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    }

    return fs.readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key);
    await fs.unlink(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(key: string, options?: UrlOptions): Promise<string> {
    // For local storage, return a URL that goes through our API
    const url = new URL(path.join(this.baseUrl, 'files', key));
    
    if (options?.download) {
      url.searchParams.set('download', 'true');
    }
    
    if (options?.filename) {
      url.searchParams.set('filename', options.filename);
    }
    
    if (options?.expiresIn) {
      const expires = Date.now() + (options.expiresIn * 1000);
      url.searchParams.set('expires', String(expires));
    }
    
    return url.toString();
  }

  async list(
    prefix: string,
    options?: ListOptions,
  ): Promise<StorageObject[]> {
    const fullPath = path.join(this.basePath, prefix);
    const results: StorageObject[] = [];

    async function* walk(dir: string): AsyncGenerator<string> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          yield* walk(entryPath);
        } else {
          yield entryPath;
        }
      }
    }

    let count = 0;
    const maxKeys = options?.maxKeys || 1000;

    for await (const filePath of walk(fullPath)) {
      if (count >= maxKeys) break;

      const key = path.relative(this.basePath, filePath);
      const stats = await fs.stat(filePath);
      
      results.push({
        key,
        size: stats.size,
        etag: '', // Would need to calculate
        lastModified: stats.mtime,
      });
      
      count++;
    }

    return results;
  }

  async copy(sourceKey: string, destKey: string): Promise<void> {
    const sourcePath = path.join(this.basePath, sourceKey);
    const destPath = path.join(this.basePath, destKey);
    const destDir = path.dirname(destPath);

    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(sourcePath, destPath);
  }

  async move(sourceKey: string, destKey: string): Promise<void> {
    const sourcePath = path.join(this.basePath, sourceKey);
    const destPath = path.join(this.basePath, destKey);
    const destDir = path.dirname(destPath);

    await fs.mkdir(destDir, { recursive: true });
    await fs.rename(sourcePath, destPath);
  }
}