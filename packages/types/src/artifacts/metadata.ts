import { z } from 'zod';

// Artifact metadata schemas
export const ArtifactMetadataSchema = z.object({
  // File metadata
  filename: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  encoding: z.string().optional(),
  checksum: z.string().optional(),
  
  // Processing metadata
  processingStatus: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  processingTime: z.number().optional(), // in ms
  processingError: z.string().optional(),
  
  // Quality metadata
  quality: z.object({
    score: z.number().min(0).max(1).optional(),
    issues: z.array(z.object({
      type: z.enum(['warning', 'error', 'info']),
      message: z.string(),
      location: z.string().optional()
    })).default([])
  }).optional(),
  
  // Usage metadata
  views: z.number().default(0),
  downloads: z.number().default(0),
  shares: z.number().default(0),
  lastViewed: z.date().optional(),
  
  // Collaboration metadata
  collaborators: z.array(z.object({
    userId: z.string(),
    role: z.enum(['viewer', 'editor', 'owner']),
    permissions: z.array(z.enum(['view', 'edit', 'delete', 'share', 'export'])),
    addedAt: z.date(),
    addedBy: z.string()
  })).default([]),
  
  // Annotations metadata
  annotations: z.array(z.object({
    id: z.string(),
    type: z.enum(['comment', 'highlight', 'drawing', 'marker']),
    content: z.string(),
    position: z.record(z.any()), // Flexible position data
    author: z.object({
      id: z.string(),
      name: z.string(),
      avatar: z.string().optional()
    }),
    createdAt: z.date(),
    updatedAt: z.date(),
    resolved: z.boolean().default(false),
    replies: z.array(z.object({
      id: z.string(),
      content: z.string(),
      author: z.object({
        id: z.string(),
        name: z.string(),
        avatar: z.string().optional()
      }),
      createdAt: z.date()
    })).default([])
  })).default([]),
  
  // AI metadata
  aiGenerated: z.boolean().default(false),
  aiModel: z.string().optional(),
  aiPrompt: z.string().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiTags: z.array(z.string()).default([]),
  
  // Performance metadata
  renderTime: z.number().optional(), // in ms
  loadTime: z.number().optional(), // in ms
  cacheHit: z.boolean().optional(),
  
  // Security metadata
  scanned: z.boolean().default(false),
  scanResults: z.object({
    safe: z.boolean(),
    threats: z.array(z.string()).default([]),
    scannedAt: z.date()
  }).optional(),
  
  // Custom metadata (flexible key-value pairs)
  custom: z.record(z.any()).optional()
});

export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;

// Metadata for specific artifact types
export const ChartMetadataSchema = ArtifactMetadataSchema.extend({
  dataPoints: z.number().optional(),
  dimensions: z.number().optional(),
  dataSource: z.string().optional(),
  refreshRate: z.number().optional(), // in seconds
  lastUpdated: z.date().optional(),
  interactive: z.boolean().default(false)
});

export type ChartMetadata = z.infer<typeof ChartMetadataSchema>;

export const TableMetadataSchema = ArtifactMetadataSchema.extend({
  rowCount: z.number().optional(),
  columnCount: z.number().optional(),
  dataSource: z.string().optional(),
  schema: z.array(z.object({
    column: z.string(),
    type: z.string(),
    nullable: z.boolean(),
    unique: z.boolean().optional(),
    description: z.string().optional()
  })).optional(),
  indexes: z.array(z.string()).optional(),
  compressed: z.boolean().default(false)
});

export type TableMetadata = z.infer<typeof TableMetadataSchema>;

export const CodeMetadataSchema = ArtifactMetadataSchema.extend({
  language: z.string(),
  lineCount: z.number().optional(),
  complexity: z.object({
    cyclomatic: z.number(),
    cognitive: z.number(),
    halstead: z.record(z.number()).optional()
  }).optional(),
  dependencies: z.array(z.string()).optional(),
  functions: z.array(z.object({
    name: z.string(),
    line: z.number(),
    complexity: z.number().optional()
  })).optional(),
  executable: z.boolean().default(false)
});

export type CodeMetadata = z.infer<typeof CodeMetadataSchema>;

export const ImageMetadataSchema = ArtifactMetadataSchema.extend({
  dimensions: z.object({
    width: z.number(),
    height: z.number()
  }),
  format: z.string(),
  colorSpace: z.string().optional(),
  dpi: z.number().optional(),
  hasTransparency: z.boolean().default(false),
  exif: z.record(z.any()).optional(),
  faces: z.array(z.object({
    bounds: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }),
    confidence: z.number()
  })).optional(),
  objects: z.array(z.object({
    label: z.string(),
    bounds: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number()
    }),
    confidence: z.number()
  })).optional()
});

export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;

export const VideoMetadataSchema = ArtifactMetadataSchema.extend({
  duration: z.number(), // in seconds
  dimensions: z.object({
    width: z.number(),
    height: z.number()
  }),
  frameRate: z.number(),
  bitrate: z.number().optional(),
  codec: z.string().optional(),
  hasAudio: z.boolean().default(false),
  audioCodec: z.string().optional(),
  thumbnails: z.array(z.object({
    time: z.number(), // timestamp in seconds
    url: z.string()
  })).optional(),
  chapters: z.array(z.object({
    title: z.string(),
    start: z.number(),
    end: z.number()
  })).optional()
});

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export const AudioMetadataSchema = ArtifactMetadataSchema.extend({
  duration: z.number(), // in seconds
  sampleRate: z.number().optional(),
  bitrate: z.number().optional(),
  channels: z.number().default(2),
  codec: z.string().optional(),
  waveform: z.array(z.number()).optional(),
  peaks: z.array(z.number()).optional(),
  transcript: z.string().optional(),
  metadata: z.object({
    title: z.string().optional(),
    artist: z.string().optional(),
    album: z.string().optional(),
    year: z.number().optional(),
    genre: z.string().optional()
  }).optional()
});

export type AudioMetadata = z.infer<typeof AudioMetadataSchema>;

export const PDFMetadataSchema = ArtifactMetadataSchema.extend({
  pageCount: z.number(),
  hasText: z.boolean().default(false),
  hasImages: z.boolean().default(false),
  encrypted: z.boolean().default(false),
  version: z.string().optional(),
  producer: z.string().optional(),
  creator: z.string().optional(),
  subject: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  outline: z.array(z.object({
    title: z.string(),
    page: z.number(),
    level: z.number()
  })).optional(),
  searchable: z.boolean().default(false)
});

export type PDFMetadata = z.infer<typeof PDFMetadataSchema>;