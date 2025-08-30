import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

export interface VirtualFile {
  name: string;
  path: string;
  content: Buffer;
  metadata: {
    size: number;
    created: Date;
    modified: Date;
    permissions: number;
    checksum: string;
    mimeType?: string;
  };
}

export interface VirtualDirectory {
  name: string;
  path: string;
  files: Map<string, VirtualFile>;
  directories: Map<string, VirtualDirectory>;
  metadata: {
    created: Date;
    modified: Date;
    permissions: number;
  };
}

export class VirtualFileSystem {
  private root: VirtualDirectory;
  private maxFileSize = 10 * 1024 * 1024; // 10MB
  private maxTotalSize = 100 * 1024 * 1024; // 100MB
  private maxFiles = 1000;
  private currentSize = 0;
  private currentFileCount = 0;
\n  constructor(rootPath = '/workspace') {\n    this.root = this.createDirectory('', rootPath);
  }

  // File operations
  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    
    // Check file size limit
    if (buffer.length > this.maxFileSize) {
      throw new Error(`File size exceeds limit: ${buffer.length} > ${this.maxFileSize}`);
    }

    // Check total size limit
    if (this.currentSize + buffer.length > this.maxTotalSize) {\n      throw new Error(`Total filesystem size would exceed limit: ${this.currentSize + buffer.length} > ${this.maxTotalSize}`);
    }

    // Check file count limit
    if (!this.fileExists(normalizedPath) && this.currentFileCount >= this.maxFiles) {\n      throw new Error(`File count exceeds limit: ${this.currentFileCount} >= ${this.maxFiles}`);
    }

    const { dir, name } = this.parsePath(normalizedPath);
    const directory = this.ensureDirectory(dir);
    
    // Remove existing file if it exists
    if (directory.files.has(name)) {
      const existingFile = directory.files.get(name)!;
      this.currentSize -= existingFile.metadata.size;
    } else {
      this.currentFileCount++;
    }

    const file: VirtualFile = {
      name,
      path: normalizedPath,
      content: buffer,
      metadata: {
        size: buffer.length,
        created: new Date(),
        modified: new Date(),
        permissions: 0o644,
        checksum: this.calculateChecksum(buffer),
        mimeType: this.detectMimeType(name)
      }
    };

    directory.files.set(name, file);
    directory.metadata.modified = new Date();
    this.currentSize += buffer.length;
  }

  async readFile(filePath: string): Promise<Buffer> {
    const normalizedPath = this.normalizePath(filePath);
    const { dir, name } = this.parsePath(normalizedPath);
    
    const directory = this.getDirectory(dir);
    if (!directory) {\n      throw new Error(`Directory not found: ${dir}`);
    }

    const file = directory.files.get(name);
    if (!file) {\n      throw new Error(`File not found: ${filePath}`);
    }

    return file.content;
  }

  async readFileAsString(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    const buffer = await this.readFile(filePath);
    return buffer.toString(encoding);
  }

  fileExists(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    const { dir, name } = this.parsePath(normalizedPath);
    
    const directory = this.getDirectory(dir);
    return directory ? directory.files.has(name) : false;
  }

  async deleteFile(filePath: string): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    const { dir, name } = this.parsePath(normalizedPath);
    
    const directory = this.getDirectory(dir);
    if (!directory) {\n      throw new Error(`Directory not found: ${dir}`);
    }

    const file = directory.files.get(name);
    if (!file) {\n      throw new Error(`File not found: ${filePath}`);
    }

    directory.files.delete(name);
    directory.metadata.modified = new Date();
    this.currentSize -= file.metadata.size;
    this.currentFileCount--;
  }

  async getFileInfo(filePath: string): Promise<VirtualFile['metadata']> {
    const normalizedPath = this.normalizePath(filePath);
    const { dir, name } = this.parsePath(normalizedPath);
    
    const directory = this.getDirectory(dir);
    if (!directory) {\n      throw new Error(`Directory not found: ${dir}`);
    }

    const file = directory.files.get(name);
    if (!file) {\n      throw new Error(`File not found: ${filePath}`);
    }

    return { ...file.metadata };
  }

  // Directory operations
  async createDirectory(name: string, dirPath: string): Promise<VirtualDirectory> {
    const directory: VirtualDirectory = {
      name,
      path: dirPath,
      files: new Map(),
      directories: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
        permissions: 0o755
      }
    };

    return directory;
  }

  async mkdir(dirPath: string): Promise<void> {
    this.ensureDirectory(this.normalizePath(dirPath));
  }

  directoryExists(dirPath: string): boolean {
    return this.getDirectory(this.normalizePath(dirPath)) !== null;
  }

  async rmdir(dirPath: string, recursive = false): Promise<void> {
    const normalizedPath = this.normalizePath(dirPath);
    const { dir: parentPath, name } = this.parsePath(normalizedPath);
    
    const parentDir = this.getDirectory(parentPath);
    if (!parentDir) {\n      throw new Error(`Parent directory not found: ${parentPath}`);
    }

    const directory = parentDir.directories.get(name);
    if (!directory) {\n      throw new Error(`Directory not found: ${dirPath}`);
    }

    if (!recursive && (directory.files.size > 0 || directory.directories.size > 0)) {\n      throw new Error(`Directory not empty: ${dirPath}`);
    }

    if (recursive) {
      // Recursively delete all contents
      await this.deleteDirContents(directory);
    }

    parentDir.directories.delete(name);
    parentDir.metadata.modified = new Date();
  }

  async listDirectory(dirPath: string): Promise<{
    files: Array<{ name: string; size: number; modified: Date; type: 'file' }>;
    directories: Array<{ name: string; modified: Date; type: 'directory' }>;
  }> {
    const normalizedPath = this.normalizePath(dirPath);
    const directory = this.getDirectory(normalizedPath);
    
    if (!directory) {\n      throw new Error(`Directory not found: ${dirPath}`);
    }

    const files = Array.from(directory.files.values()).map(file => ({
      name: file.name,
      size: file.metadata.size,
      modified: file.metadata.modified,
      type: 'file' as const
    }));

    const directories = Array.from(directory.directories.values()).map(dir => ({
      name: dir.name,
      modified: dir.metadata.modified,
      type: 'directory' as const
    }));

    return { files, directories };
  }

  // Utility methods
  async syncToHost(hostPath: string): Promise<void> {
    await this.syncDirectoryToHost(this.root, hostPath);
  }

  async syncFromHost(hostPath: string): Promise<void> {
    await this.syncDirectoryFromHost(this.root, hostPath);
  }

  private async syncDirectoryToHost(vdir: VirtualDirectory, hostPath: string): Promise<void> {
    try {
      await fs.mkdir(hostPath, { recursive: true });

      // Sync files
      for (const [name, file] of vdir.files) {
        const filePath = path.join(hostPath, name);
        await fs.writeFile(filePath, file.content);
      }

      // Sync subdirectories
      for (const [name, subdir] of vdir.directories) {
        const subdirPath = path.join(hostPath, name);
        await this.syncDirectoryToHost(subdir, subdirPath);
      }
    } catch (error) {\n      throw new Error(`Failed to sync to host: ${error.message}`);
    }
  }

  private async syncDirectoryFromHost(vdir: VirtualDirectory, hostPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(hostPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(hostPath, entry.name);

        if (entry.isFile()) {
          const content = await fs.readFile(entryPath);
          const file: VirtualFile = {
            name: entry.name,
            path: path.join(vdir.path, entry.name),
            content,
            metadata: {
              size: content.length,
              created: new Date(),
              modified: new Date(),
              permissions: 0o644,
              checksum: this.calculateChecksum(content),
              mimeType: this.detectMimeType(entry.name)
            }
          };
          vdir.files.set(entry.name, file);
          this.currentSize += content.length;
          this.currentFileCount++;
        } else if (entry.isDirectory()) {
          const subdir = await this.createDirectory(entry.name, path.join(vdir.path, entry.name));
          vdir.directories.set(entry.name, subdir);
          await this.syncDirectoryFromHost(subdir, entryPath);
        }
      }
    } catch (error) {
      // Host path might not exist, which is okay
    }
  }

  private async deleteDirContents(directory: VirtualDirectory): Promise<void> {
    // Delete all files
    for (const [name, file] of directory.files) {
      this.currentSize -= file.metadata.size;
      this.currentFileCount--;
    }
    directory.files.clear();

    // Recursively delete subdirectories
    for (const [name, subdir] of directory.directories) {
      await this.deleteDirContents(subdir);
    }
    directory.directories.clear();
  }

  private normalizePath(filePath: string): string {
    // Remove leading slash and normalize path separators\n    return path.normalize(filePath.replace(/^\/+/, '')).replace(/\\/g, '/');
  }

  private parsePath(filePath: string): { dir: string; name: string } {
    const normalized = this.normalizePath(filePath);\n    const lastSlash = normalized.lastIndexOf('/');
    
    if (lastSlash === -1) {\n      return { dir: '', name: normalized };
    }
    
    return {
      dir: normalized.substring(0, lastSlash),
      name: normalized.substring(lastSlash + 1)
    };
  }

  private getDirectory(dirPath: string): VirtualDirectory | null {\n    if (!dirPath || dirPath === '') {
      return this.root;
    }
\n    const parts = dirPath.split('/').filter(part => part !== '');
    let current = this.root;

    for (const part of parts) {
      const subdir = current.directories.get(part);
      if (!subdir) {
        return null;
      }
      current = subdir;
    }

    return current;
  }

  private ensureDirectory(dirPath: string): VirtualDirectory {\n    if (!dirPath || dirPath === '') {
      return this.root;
    }
\n    const parts = dirPath.split('/').filter(part => part !== '');
    let current = this.root;\n    let currentPath = '';

    for (const part of parts) {\n      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!current.directories.has(part)) {
        const newDir = {
          name: part,
          path: currentPath,
          files: new Map(),
          directories: new Map(),
          metadata: {
            created: new Date(),
            modified: new Date(),
            permissions: 0o755
          }
        };
        current.directories.set(part, newDir);
      }
      
      current = current.directories.get(part)!;
    }

    return current;
  }

  private calculateChecksum(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private detectMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {\n      '.txt': 'text/plain',\n      '.py': 'text/x-python',\n      '.js': 'text/javascript',\n      '.json': 'application/json',\n      '.csv': 'text/csv',\n      '.html': 'text/html',\n      '.css': 'text/css',\n      '.png': 'image/png',\n      '.jpg': 'image/jpeg',\n      '.jpeg': 'image/jpeg',\n      '.gif': 'image/gif',\n      '.svg': 'image/svg+xml',\n      '.pdf': 'application/pdf',\n      '.zip': 'application/zip'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Statistics and monitoring
  getStats(): {
    totalSize: number;
    fileCount: number;
    directoryCount: number;
    maxFileSize: number;
    maxTotalSize: number;
    utilizationPercentage: number;
  } {
    return {
      totalSize: this.currentSize,
      fileCount: this.currentFileCount,
      directoryCount: this.countDirectories(this.root),
      maxFileSize: this.maxFileSize,
      maxTotalSize: this.maxTotalSize,
      utilizationPercentage: (this.currentSize / this.maxTotalSize) * 100
    };
  }

  private countDirectories(dir: VirtualDirectory): number {
    let count = 1; // Count this directory
    for (const subdir of dir.directories.values()) {
      count += this.countDirectories(subdir);
    }
    return count;
  }

  // Configuration
  setLimits(options: {
    maxFileSize?: number;
    maxTotalSize?: number;
    maxFiles?: number;
  }): void {
    if (options.maxFileSize !== undefined) {
      this.maxFileSize = options.maxFileSize;
    }
    if (options.maxTotalSize !== undefined) {
      this.maxTotalSize = options.maxTotalSize;
    }
    if (options.maxFiles !== undefined) {
      this.maxFiles = options.maxFiles;
    }
  }

  // Cleanup
  clear(): void {\n    this.root = this.createDirectory('', '/workspace');
    this.currentSize = 0;
    this.currentFileCount = 0;
  }
}