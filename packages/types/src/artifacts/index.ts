import { z } from 'zod';

// Base artifact schema
export const ArtifactSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  messageId: z.string().optional(),
  type: z.enum([
    'chart',
    'table',
    'code',
    'markdown',
    'image',
    'pdf',
    'json',
    'html',
    'video',
    'audio',
    'model',
    'map',
    'text',
    'csv',
    'excel',
    'presentation',
    'diagram'
  ]),
  title: z.string(),
  description: z.string().optional(),
  content: z.any(), // Type-specific content
  metadata: z.record(z.any()).optional(),
  version: z.number().default(1),
  size: z.number().optional(), // Size in bytes
  mimeType: z.string().optional(),
  url: z.string().optional(), // For stored files
  thumbnailUrl: z.string().optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  tenantId: z.string(),
  exportFormats: z.array(z.string()).default([]),
  viewerConfig: z.record(z.any()).optional()
});

export type Artifact = z.infer<typeof ArtifactSchema>;

// Chart-specific types
export const ChartArtifactSchema = ArtifactSchema.extend({
  type: z.literal('chart'),
  content: z.object({
    chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'area', 'bubble', 'radar', 'treemap', 'heatmap', 'gauge']),
    data: z.array(z.record(z.any())),
    config: z.object({
      title: z.string().optional(),
      xAxis: z.object({
        label: z.string(),
        type: z.enum(['category', 'value', 'time']).default('category')
      }).optional(),
      yAxis: z.object({
        label: z.string(),
        type: z.enum(['category', 'value', 'time']).default('value')
      }).optional(),
      colors: z.array(z.string()).optional(),
      legend: z.boolean().default(true),
      tooltip: z.boolean().default(true),
      responsive: z.boolean().default(true),
      animations: z.boolean().default(true),
      theme: z.enum(['light', 'dark']).optional()
    })
  })
});

export type ChartArtifact = z.infer<typeof ChartArtifactSchema>;

// Table-specific types
export const TableArtifactSchema = ArtifactSchema.extend({
  type: z.literal('table'),
  content: z.object({
    columns: z.array(z.object({
      key: z.string(),
      title: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'date', 'object']),
      sortable: z.boolean().default(true),
      filterable: z.boolean().default(true),
      width: z.number().optional(),
      align: z.enum(['left', 'center', 'right']).default('left'),
      format: z.string().optional() // For date/number formatting
    })),
    data: z.array(z.record(z.any())),
    config: z.object({
      pagination: z.object({
        enabled: z.boolean().default(true),
        pageSize: z.number().default(25),
        showSizeChanger: z.boolean().default(true)
      }),
      sorting: z.object({
        enabled: z.boolean().default(true),
        defaultSort: z.object({
          column: z.string(),
          direction: z.enum(['asc', 'desc'])
        }).optional()
      }),
      filtering: z.object({
        enabled: z.boolean().default(true),
        searchable: z.boolean().default(true)
      }),
      selection: z.object({
        enabled: z.boolean().default(false),
        multiple: z.boolean().default(false)
      }),
      export: z.object({
        enabled: z.boolean().default(true),
        formats: z.array(z.enum(['csv', 'excel', 'pdf'])).default(['csv'])
      }),
      virtualization: z.boolean().default(false),
      rowHeight: z.number().default(40)
    })
  })
});

export type TableArtifact = z.infer<typeof TableArtifactSchema>;

// Code-specific types
export const CodeArtifactSchema = ArtifactSchema.extend({
  type: z.literal('code'),
  content: z.object({
    code: z.string(),
    language: z.string(),
    filename: z.string().optional(),
    config: z.object({
      theme: z.enum(['light', 'dark']).default('light'),
      showLineNumbers: z.boolean().default(true),
      highlightLines: z.array(z.number()).optional(),
      wordWrap: z.boolean().default(false),
      fontSize: z.number().default(14),
      tabSize: z.number().default(2),
      readOnly: z.boolean().default(true),
      showMinimap: z.boolean().default(false),
      folding: z.boolean().default(true)
    })
  })
});

export type CodeArtifact = z.infer<typeof CodeArtifactSchema>;

// Image-specific types
export const ImageArtifactSchema = ArtifactSchema.extend({
  type: z.literal('image'),
  content: z.object({
    src: z.string(),
    alt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    config: z.object({
      zoomable: z.boolean().default(true),
      downloadable: z.boolean().default(true),
      showMetadata: z.boolean().default(false),
      annotations: z.array(z.object({
        id: z.string(),
        type: z.enum(['rectangle', 'circle', 'arrow', 'text']),
        position: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number().optional(),
          height: z.number().optional()
        }),
        content: z.string().optional(),
        style: z.record(z.any()).optional()
      })).default([])
    })
  })
});

export type ImageArtifact = z.infer<typeof ImageArtifactSchema>;

// Map-specific types
export const MapArtifactSchema = ArtifactSchema.extend({
  type: z.literal('map'),
  content: z.object({
    center: z.object({
      lat: z.number(),
      lng: z.number()
    }),
    zoom: z.number().default(10),
    markers: z.array(z.object({
      id: z.string(),
      position: z.object({
        lat: z.number(),
        lng: z.number()
      }),
      title: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      popup: z.boolean().default(false)
    })).default([]),
    layers: z.array(z.object({
      id: z.string(),
      type: z.enum(['tile', 'vector', 'raster', 'heatmap', 'cluster']),
      source: z.string(),
      visible: z.boolean().default(true),
      opacity: z.number().default(1),
      style: z.record(z.any()).optional()
    })).default([]),
    config: z.object({
      style: z.enum(['streets', 'satellite', 'terrain', 'dark', 'light']).default('streets'),
      controls: z.object({
        zoom: z.boolean().default(true),
        fullscreen: z.boolean().default(true),
        navigation: z.boolean().default(true),
        scale: z.boolean().default(false)
      }),
      interactions: z.object({
        doubleClickZoom: z.boolean().default(true),
        dragPan: z.boolean().default(true),
        scrollZoom: z.boolean().default(true),
        touchZoom: z.boolean().default(true)
      })
    })
  })
});

export type MapArtifact = z.infer<typeof MapArtifactSchema>;

// Artifact actions
export const ArtifactActionSchema = z.object({
  type: z.enum(['create', 'update', 'delete', 'share', 'export', 'version', 'annotate']),
  artifactId: z.string(),
  userId: z.string(),
  data: z.record(z.any()).optional(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional()
});

export type ArtifactAction = z.infer<typeof ArtifactActionSchema>;

// Artifact collection
export const ArtifactCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  artifacts: z.array(z.string()), // Artifact IDs
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  tenantId: z.string()
});

export type ArtifactCollection = z.infer<typeof ArtifactCollectionSchema>;

// Export all types
export * from './metadata';
export * from './versions';
export * from './renderers';