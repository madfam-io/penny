// Placeholder types for build
export interface Artifact {
  id: string;
  type: string;
  name: string;
  content: any;
  createdAt: Date;
  updatedAt: Date;
  // Extended properties
  title?: string;
  description?: string;
  version?: number;
  size?: number;
  tags?: string[];
  exportFormats?: string[];
  metadata?: Record<string, any>;
  createdBy?: string;
  isPublic?: boolean;
  url?: string;
  mimeType?: string;
}

export interface CodeArtifact extends Artifact {
  type: 'code';
  content: {
    code: string;
    language: string;
    filename?: string;
    config?: any;
  };
}

export interface ChartArtifact extends Artifact {
  type: 'chart';
  content: {
    data: any;
    chartType: string;
    config?: any;
  };
  title?: string;
}

export interface TableArtifact extends Artifact {
  type: 'table';
  content: {
    columns: any[];
    rows: any[][];
    data?: any[];
    config?: any;
  };
}

export interface ImageArtifact extends Artifact {
  type: 'image';
  content: {
    url: string;
    alt?: string;
    src?: string;
    width?: number;
    height?: number;
    config?: any;
  };
  title?: string;
  size?: number;
  mimeType?: string;
}

export interface VideoArtifact extends Artifact {
  type: 'video';
}

export interface AudioArtifact extends Artifact {
  type: 'audio';
}

export interface PDFArtifact extends Artifact {
  type: 'pdf';
}

export interface HTMLArtifact extends Artifact {
  type: 'html';
}

export interface MarkdownArtifact extends Artifact {
  type: 'markdown';
}

export interface JSONArtifact extends Artifact {
  type: 'json';
}

export interface MapArtifact extends Artifact {
  type: 'map';
}

export interface ModelArtifact extends Artifact {
  type: 'model';
}

export interface ArtifactCollection {
  id: string;
  name: string;
  artifacts: Artifact[];
  createdAt: Date;
  updatedAt: Date;
}