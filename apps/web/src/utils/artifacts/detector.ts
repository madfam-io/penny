import { Artifact } from '@penny/types';

export interface DetectionResult {
  type: Artifact['type'];
  confidence: number;
  metadata?: Record<string, any>;
  suggestedTitle?: string;
}

export interface FileInfo {
  name: string;
  size: number;
  type?: string;
  content?: string | ArrayBuffer;
  lastModified?: number;
}

export class ArtifactDetector {
  /**
   * Detect artifact type from file information
   */
  static detectFromFile(file: FileInfo): DetectionResult {
    // Check MIME type first
    if (file.type) {
      const mimeResult = this.detectFromMimeType(file.type);
      if (mimeResult.confidence > 0.8) {
        return {
          ...mimeResult,
          suggestedTitle: this.generateTitleFromFilename(file.name),
          metadata: {
            originalFilename: file.name,
            fileSize: file.size,
            mimeType: file.type
          }
        };
      }
    }

    // Fallback to extension-based detection
    const extensionResult = this.detectFromExtension(file.name);
    return {
      ...extensionResult,
      suggestedTitle: this.generateTitleFromFilename(file.name),
      metadata: {
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type
      }
    };
  }

  /**
   * Detect artifact type from content
   */
  static detectFromContent(content: any): DetectionResult {
    if (typeof content === 'string') {
      return this.detectFromString(content);
    }

    if (typeof content === 'object' && content !== null) {
      return this.detectFromObject(content);
    }

    return {
      type: 'text',
      confidence: 0.3
    };
  }

  /**
   * Detect artifact type from URL
   */
  static detectFromUrl(url: string): DetectionResult {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // Check for common patterns\n      if (pathname.includes('/embed') || urlObj.hostname.includes('youtube') || urlObj.hostname.includes('vimeo')) {
        return { type: 'video', confidence: 0.9 };
      }
\n      if (pathname.includes('/map') || urlObj.hostname.includes('maps.google') || urlObj.hostname.includes('openstreetmap')) {
        return { type: 'map', confidence: 0.9 };
      }

      // Fall back to extension detection
      return this.detectFromExtension(pathname);
    } catch {
      return { type: 'html', confidence: 0.5 };
    }
  }

  /**
   * Auto-detect from multiple sources
   */
  static autoDetect(input: { 
    file?: FileInfo; 
    content?: any; 
    url?: string; 
    mimeType?: string;
  }): DetectionResult {
    const results: DetectionResult[] = [];

    if (input.file) {
      results.push(this.detectFromFile(input.file));
    }

    if (input.content) {
      results.push(this.detectFromContent(input.content));
    }

    if (input.url) {
      results.push(this.detectFromUrl(input.url));
    }

    if (input.mimeType) {
      results.push(this.detectFromMimeType(input.mimeType));
    }

    // Return result with highest confidence
    if (results.length === 0) {
      return { type: 'text', confidence: 0.1 };
    }

    return results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  private static detectFromMimeType(mimeType: string): DetectionResult {
    const type = mimeType.toLowerCase();

    // Images
    if (type.startsWith('image/')) {
      return { type: 'image', confidence: 1.0 };
    }

    // Videos
    if (type.startsWith('video/')) {
      return { type: 'video', confidence: 1.0 };
    }

    // Audio
    if (type.startsWith('audio/')) {
      return { type: 'audio', confidence: 1.0 };
    }

    // Documents
    if (type === 'application/pdf') {
      return { type: 'pdf', confidence: 1.0 };
    }

    if (type === 'application/json') {
      return { type: 'json', confidence: 1.0 };
    }

    if (type === 'text/html') {
      return { type: 'html', confidence: 1.0 };
    }

    if (type === 'text/markdown' || type === 'text/x-markdown') {
      return { type: 'markdown', confidence: 1.0 };
    }

    if (type.startsWith('text/')) {
      return { type: 'code', confidence: 0.7 };
    }

    // Spreadsheets
    if (type.includes('spreadsheet') || type.includes('excel')) {
      return { type: 'table', confidence: 0.9 };
    }

    // 3D Models
    if (type.includes('model') || type === 'application/octet-stream') {
      return { type: 'model', confidence: 0.6 };
    }

    return { type: 'text', confidence: 0.3 };
  }

  private static detectFromExtension(filename: string): DetectionResult {\n    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (!ext) {
      return { type: 'text', confidence: 0.2 };
    }

    const extensionMap: Record<string, { type: Artifact['type']; confidence: number }> = {
      // Images
      'jpg': { type: 'image', confidence: 1.0 },
      'jpeg': { type: 'image', confidence: 1.0 },
      'png': { type: 'image', confidence: 1.0 },
      'gif': { type: 'image', confidence: 1.0 },
      'webp': { type: 'image', confidence: 1.0 },
      'svg': { type: 'image', confidence: 1.0 },
      'bmp': { type: 'image', confidence: 1.0 },

      // Videos
      'mp4': { type: 'video', confidence: 1.0 },
      'webm': { type: 'video', confidence: 1.0 },
      'mov': { type: 'video', confidence: 1.0 },
      'avi': { type: 'video', confidence: 1.0 },
      'mkv': { type: 'video', confidence: 1.0 },

      // Audio
      'mp3': { type: 'audio', confidence: 1.0 },
      'wav': { type: 'audio', confidence: 1.0 },
      'flac': { type: 'audio', confidence: 1.0 },
      'ogg': { type: 'audio', confidence: 1.0 },
      'aac': { type: 'audio', confidence: 1.0 },

      // Code
      'js': { type: 'code', confidence: 1.0 },
      'ts': { type: 'code', confidence: 1.0 },
      'jsx': { type: 'code', confidence: 1.0 },
      'tsx': { type: 'code', confidence: 1.0 },
      'py': { type: 'code', confidence: 1.0 },
      'java': { type: 'code', confidence: 1.0 },
      'cpp': { type: 'code', confidence: 1.0 },
      'c': { type: 'code', confidence: 1.0 },
      'h': { type: 'code', confidence: 1.0 },
      'cs': { type: 'code', confidence: 1.0 },
      'php': { type: 'code', confidence: 1.0 },
      'rb': { type: 'code', confidence: 1.0 },
      'go': { type: 'code', confidence: 1.0 },
      'rs': { type: 'code', confidence: 1.0 },
      'swift': { type: 'code', confidence: 1.0 },
      'kt': { type: 'code', confidence: 1.0 },
      'scala': { type: 'code', confidence: 1.0 },

      // Documents
      'pdf': { type: 'pdf', confidence: 1.0 },
      'html': { type: 'html', confidence: 1.0 },
      'htm': { type: 'html', confidence: 1.0 },
      'md': { type: 'markdown', confidence: 1.0 },
      'markdown': { type: 'markdown', confidence: 1.0 },
      'json': { type: 'json', confidence: 1.0 },
      'xml': { type: 'code', confidence: 0.9 },
      'yaml': { type: 'code', confidence: 0.9 },
      'yml': { type: 'code', confidence: 0.9 },

      // Data
      'csv': { type: 'table', confidence: 1.0 },
      'tsv': { type: 'table', confidence: 1.0 },
      'xlsx': { type: 'table', confidence: 1.0 },
      'xls': { type: 'table', confidence: 1.0 },

      // 3D Models
      'obj': { type: 'model', confidence: 1.0 },
      'stl': { type: 'model', confidence: 1.0 },
      'glb': { type: 'model', confidence: 1.0 },
      'gltf': { type: 'model', confidence: 1.0 },
      'fbx': { type: 'model', confidence: 1.0 },
      'dae': { type: 'model', confidence: 1.0 },

      // Text
      'txt': { type: 'text', confidence: 1.0 },
      'log': { type: 'code', confidence: 0.8 },
    };

    return extensionMap[ext] || { type: 'text', confidence: 0.4 };
  }

  private static detectFromString(content: string): DetectionResult {
    const trimmed = content.trim();

    // Check for JSON\n    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || \n        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(content);
        return { type: 'json', confidence: 0.9 };
      } catch {
        // Not valid JSON, continue checking
      }
    }

    // Check for HTML\n    if (trimmed.includes('<html') || trimmed.includes('<!DOCTYPE') || \n        (trimmed.includes('<') && trimmed.includes('>'))) {
      return { type: 'html', confidence: 0.8 };
    }

    // Check for Markdown\n    if (trimmed.includes('# ') || trimmed.includes('## ') || \n        trimmed.includes('```') || trimmed.includes('[') && trimmed.includes('](')) {
      return { type: 'markdown', confidence: 0.7 };
    }

    // Check for CSV-like content\n    if (trimmed.includes(',') && trimmed.split('\n').length > 1) {
      const lines = trimmed.split('\n');
      const firstLine = lines[0];
      const secondLine = lines[1];
      
      if (firstLine && secondLine && 
          firstLine.split(',').length === secondLine.split(',').length) {
        return { type: 'table', confidence: 0.6 };
      }
    }

    // Check for code patterns
    if (this.looksLikeCode(content)) {
      return { type: 'code', confidence: 0.6 };
    }

    return { type: 'text', confidence: 0.5 };
  }

  private static detectFromObject(content: any): DetectionResult {
    // Check for chart data patterns
    if (content.chartType && content.data && Array.isArray(content.data)) {
      return { type: 'chart', confidence: 0.95 };
    }

    // Check for table data patterns
    if (content.columns && content.data && 
        Array.isArray(content.columns) && Array.isArray(content.data)) {
      return { type: 'table', confidence: 0.95 };
    }

    // Check for map data patterns
    if (content.center && content.markers && 
        typeof content.center.lat === 'number' && typeof content.center.lng === 'number') {
      return { type: 'map', confidence: 0.9 };
    }

    // Check for code object
    if (content.code && typeof content.code === 'string' && content.language) {
      return { type: 'code', confidence: 0.9 };
    }

    // Check for image object
    if (content.src && typeof content.src === 'string') {
      return { type: 'image', confidence: 0.7 };
    }

    // Default to JSON
    return { type: 'json', confidence: 0.8 };
  }

  private static looksLikeCode(content: string): boolean {
    const codePatterns = [
      /function\s+\w+\s*\(/,
      /class\s+\w+/,
      /import\s+.*from/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /{[\s\S]*}/,
      /\w+\s*\(.*\)\s*{/,
      /^\s*\/\/.*$/m,
      /^\s*\/\*[\s\S]*?\*\/$/m
    ];

    return codePatterns.some(pattern => pattern.test(content));
  }

  private static generateTitleFromFilename(filename: string): string {
    // Remove extension\n    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Replace underscores and hyphens with spaces\n    const formatted = nameWithoutExt.replace(/[_-]/g, ' ');
    
    // Capitalize first letter of each word
    return formatted.replace(/\b\w/g, letter => letter.toUpperCase());
  }

  /**
   * Validate detected type against content
   */
  static validateDetection(type: Artifact['type'], content: any): boolean {
    try {
      switch (type) {
        case 'json':
          JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
          return true;
          
        case 'chart':
          return typeof content === 'object' && 
                 content.chartType && 
                 Array.isArray(content.data);
          
        case 'table':
          return typeof content === 'object' && 
                 Array.isArray(content.columns) && 
                 Array.isArray(content.data);
          
        case 'code':
          return typeof content === 'object' ? 
                 typeof content.code === 'string' :
                 typeof content === 'string';
          
        default:
          return true; // Other types are less strict
      }
    } catch {
      return false;
    }
  }
}