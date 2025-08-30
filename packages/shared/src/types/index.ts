// Placeholder types for build
export interface Artifact {
  id: string;
  type: string;
  name: string;
  content: any;
  createdAt: Date;
  updatedAt: Date;
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
}

export interface TableArtifact extends Artifact {
  type: 'table';
  content: {
    columns: string[];
    rows: any[][];
    config?: any;
  };
}

export interface ImageArtifact extends Artifact {
  type: 'image';
  content: {
    url: string;
    alt?: string;
  };
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