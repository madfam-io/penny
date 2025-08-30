import { Artifact } from '@penny/types';
import { ArtifactTransformer } from './transformer';

export interface ExportOptions {
  format: ExportFormat;
  quality?: number;
  includeMetadata?: boolean;
  customName?: string;
  compression?: boolean;
  watermark?: boolean;
}

export type ExportFormat = 
  | 'png' | 'svg' | 'pdf' | 'jpg' | 'webp'
  | 'csv' | 'excel' | 'json' | 'xml'
  | 'html' | 'markdown' | 'txt'
  | 'mp4' | 'webm' | 'gif'
  | 'zip' | 'tar';

export interface ExportResult {
  success: boolean;
  data?: Blob | string;
  filename?: string;
  mimeType?: string;
  error?: string;
  size?: number;
}

export class ArtifactExporter {
  /**
   * Export artifact to specified format
   */
  static async export(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    try {
      const exporter = this.getExporter(artifact.type, options.format);
      const result = await exporter(artifact, options);
      
      return {
        ...result,
        filename: options.customName || this.generateFilename(artifact, options.format),
        size: result.data instanceof Blob ? result.data.size : 
              typeof result.data === 'string' ? new Blob([result.data]).size : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  /**
   * Get supported export formats for artifact type
   */
  static getSupportedFormats(artifactType: Artifact['type']): ExportFormat[] {
    const formatMap: Record<Artifact['type'], ExportFormat[]> = {
      chart: ['png', 'svg', 'pdf', 'json', 'csv', 'html'],
      table: ['csv', 'excel', 'pdf', 'json', 'html', 'txt'],
      code: ['txt', 'pdf', 'html'],
      image: ['png', 'jpg', 'webp', 'pdf'],
      video: ['mp4', 'webm', 'gif'],
      audio: ['mp4', 'webm'],
      json: ['json', 'csv', 'txt', 'xml'],
      html: ['html', 'pdf', 'txt'],
      markdown: ['html', 'pdf', 'txt'],
      pdf: ['pdf'],
      map: ['png', 'svg', 'pdf', 'json'],
      model: ['json', 'txt'],
      text: ['txt', 'html', 'pdf']
    };
    
    return formatMap[artifactType] || ['json', 'txt'];
  }

  /**
   * Bulk export multiple artifacts
   */
  static async bulkExport(
    artifacts: Artifact[], 
    options: ExportOptions & { zipName?: string }
  ): Promise<ExportResult> {
    try {
      const exports = await Promise.all(
        artifacts.map(artifact => this.export(artifact, options))
      );
      
      const failed = exports.filter(e => !e.success);
      if (failed.length > 0) {
        return {
          success: false,
          error: `${failed.length} exports failed`
        };
      }
      
      if (options.format === 'zip') {
        return await this.createZipArchive(exports, options.zipName || 'artifacts.zip');
      }
      
      // For non-zip formats, return first successful export
      return exports[0];
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk export failed'
      };
    }
  }

  /**
   * Export with custom template
   */
  static async exportWithTemplate(
    artifact: Artifact, 
    templateType: 'report' | 'presentation' | 'dashboard',
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const template = await this.getTemplate(templateType);
      const processedData = await this.processForTemplate(artifact, template);
      
      return await this.export(
        { ...artifact, content: processedData },
        options
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Template export failed'
      };
    }
  }

  private static getExporter(artifactType: Artifact['type'], format: ExportFormat) {
    const key = `${artifactType}_${format}`;
    
    // Chart exporters
    if (artifactType === 'chart') {
      switch (format) {
        case 'png': return this.exportChartAsPNG;
        case 'svg': return this.exportChartAsSVG;
        case 'pdf': return this.exportChartAsPDF;
        case 'json': return this.exportAsJSON;
        case 'csv': return this.exportChartAsCSV;
        case 'html': return this.exportChartAsHTML;
      }
    }
    
    // Table exporters
    if (artifactType === 'table') {
      switch (format) {
        case 'csv': return this.exportTableAsCSV;
        case 'excel': return this.exportTableAsExcel;
        case 'pdf': return this.exportTableAsPDF;
        case 'json': return this.exportAsJSON;
        case 'html': return this.exportTableAsHTML;
        case 'txt': return this.exportTableAsText;
      }
    }
    
    // Code exporters
    if (artifactType === 'code') {
      switch (format) {
        case 'txt': return this.exportCodeAsText;
        case 'pdf': return this.exportCodeAsPDF;
        case 'html': return this.exportCodeAsHTML;
      }
    }
    
    // Image exporters
    if (artifactType === 'image') {
      switch (format) {
        case 'png': case 'jpg': case 'webp': return this.exportImageFormat;
        case 'pdf': return this.exportImageAsPDF;
      }
    }
    
    // Default exporters
    switch (format) {
      case 'json': return this.exportAsJSON;
      case 'txt': return this.exportAsText;
      case 'html': return this.exportAsHTML;
      case 'pdf': return this.exportAsPDF;
      default: return this.exportAsJSON;
    }
  }

  // Chart export functions
  private static async exportChartAsPNG(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    // Mock PNG generation - would use canvas or headless browser
    const mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;
    
    // Mock chart rendering
    const ctx = mockCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#333';
      ctx.font = '24px Arial';
      ctx.fillText(artifact.title, 50, 50);
      ctx.fillStyle = '#007bff';
      ctx.fillRect(100, 100, 200, 300);
    }
    
    return new Promise(resolve => {
      mockCanvas.toBlob(blob => {
        resolve({
          success: true,
          data: blob!,
          mimeType: 'image/png'
        });
      }, 'image/png', options.quality || 0.9);
    });
  }

  private static async exportChartAsSVG(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const chartData = artifact.content;
    
    // Mock SVG generation\n    const svg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">\n        <rect width="800" height="600" fill="#f8f9fa"/>\n        <text x="50" y="50" font-family="Arial" font-size="24" fill="#333">${artifact.title}</text>\n        <rect x="100" y="100" width="200" height="300" fill="#007bff"/>
        <!-- Chart elements would be generated here based on chartData -->
      </svg>
    `;
    
    return {
      success: true,
      data: new Blob([svg], { type: 'image/svg+xml' }),
      mimeType: 'image/svg+xml'
    };
  }

  private static async exportChartAsPDF(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    // Mock PDF generation - would use jsPDF or similar
    const mockPDFContent = `%PDF-1.4\
1 0 obj\
<<\
/Type /Catalog\
/Pages 2 0 R\
>>\
endobj\
\
% Mock PDF for ${artifact.title}\
`;
    
    return {
      success: true,
      data: new Blob([mockPDFContent], { type: 'application/pdf' }),
      mimeType: 'application/pdf'
    };
  }

  private static async exportChartAsCSV(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const chartData = artifact.content;
    const transformResult = ArtifactTransformer.toCSV(chartData.data, {});
    
    if (!transformResult.success) {
      return {
        success: false,
        error: transformResult.error
      };
    }
    
    return {
      success: true,
      data: new Blob([transformResult.data!], { type: 'text/csv' }),
      mimeType: 'text/csv'
    };
  }

  private static async exportChartAsHTML(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const chartData = artifact.content;
   
   const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${artifact.title}</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        <h1>${artifact.title}</h1>\n        <canvas id="chart" width="800" height="400"></canvas>
        <script>
          const ctx = document.getElementById('chart').getContext('2d');
          new Chart(ctx, ${JSON.stringify({
            type: chartData.chartType,
            data: { datasets: [{ data: chartData.data }] },
            options: chartData.config
          }, null, 2)});
        </script>
      </body>
      </html>
    `;
    
    return {
      success: true,
      data: new Blob([html], { type: 'text/html' }),
      mimeType: 'text/html'
    };
  }

  // Table export functions
  private static async exportTableAsCSV(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const tableData = artifact.content;
    const transformResult = ArtifactTransformer.toCSV(tableData, {});
    
    if (!transformResult.success) {
      return {
        success: false,
        error: transformResult.error
      };
    }
    
    return {
      success: true,
      data: new Blob([transformResult.data!], { type: 'text/csv' }),
      mimeType: 'text/csv'
    };
  }

  private static async exportTableAsExcel(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    // Mock Excel generation - would use SheetJS or similar
    const mockExcelContent = new ArrayBuffer(8);
    
    return {
      success: true,
      data: new Blob([mockExcelContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  private static async exportTableAsPDF(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    // Mock table PDF generation\n    const mockPDFContent = `%PDF-1.4\
% Table: ${artifact.title}\
`;
    
    return {
      success: true,
      data: new Blob([mockPDFContent], { type: 'application/pdf' }),
      mimeType: 'application/pdf'
    };
  }

  private static async exportTableAsHTML(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const tableData = artifact.content;
   
   const headers = tableData.columns.map((col: any) => `<th>${col.title}</th>`).join('');
    const rows = tableData.data.map((row: any) =>
     `<tr>${tableData.columns.map((col: any) => `<td>${row[col.key] || ''}</td>`).join('')}</tr>`
    ).join('');
   
   const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${artifact.title}</title>
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>${artifact.title}</h1>
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;
    
    return {
      success: true,
      data: new Blob([html], { type: 'text/html' }),
      mimeType: 'text/html'
    };
  }

  private static async exportTableAsText(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const tableData = artifact.content;
   
   const headers = tableData.columns.map((col: any) => col.title).join('\	');
    const rows = tableData.data.map((row: any) =>
     tableData.columns.map((col: any) => row[col.key] || '').join('\	')
    ).join('\
');
   
   const text = `${artifact.title}\
${'='.repeat(artifact.title.length)}\
\
${headers}\
${rows}`;
    
    return {
      success: true,
      data: new Blob([text], { type: 'text/plain' }),
      mimeType: 'text/plain'
    };
  }

  // Generic export functions
  private static async exportAsJSON(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const exportData = {
      ...artifact,
      exportedAt: new Date().toISOString(),
      exportOptions: options
    };
    
    return {
      success: true,
      data: new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }),
      mimeType: 'application/json'
    };
  }

  private static async exportAsText(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const content = typeof artifact.content === 'string' 
      ? artifact.content 
      : JSON.stringify(artifact.content, null, 2);
   
   const text = `${artifact.title}\
${'='.repeat(artifact.title.length)}\
\
${content}`;
    
    return {
      success: true,
      data: new Blob([text], { type: 'text/plain' }),
      mimeType: 'text/plain'
    };
  }

  private static async exportAsHTML(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const content = typeof artifact.content === 'string'
      ? artifact.content\n      : `<pre>${JSON.stringify(artifact.content, null, 2)}</pre>`;
   
   const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${artifact.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; }
          pre { background: #f5f5f5; padding: 20px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>${artifact.title}</h1>
        ${content}
      </body>
      </html>
    `;
    
    return {
      success: true,
      data: new Blob([html], { type: 'text/html' }),
      mimeType: 'text/html'
    };
  }

  private static async exportAsPDF(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    // Mock PDF generation for generic content
    const mockPDFContent = `%PDF-1.4\
% ${artifact.title}\
`;
    
    return {
      success: true,
      data: new Blob([mockPDFContent], { type: 'application/pdf' }),
      mimeType: 'application/pdf'
    };
  }

  private static async exportCodeAsText(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const codeData = artifact.content;
    const code = codeData.code || '';
    
    return {
      success: true,
      data: new Blob([code], { type: 'text/plain' }),
      mimeType: 'text/plain'
    };
  }

  private static async exportCodeAsPDF(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    // Mock code PDF generation
    return {
      success: true,
      data: new Blob(['%PDF-1.4\
% Code Export'], { type: 'application/pdf' }),
      mimeType: 'application/pdf'
    };
  }

  private static async exportCodeAsHTML(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    const codeData = artifact.content;
   
   const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${artifact.title}</title>\n        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/themes/prism.min.css">\n        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/components/prism-core.min.js"></script>
      </head>
      <body>
        <h1>${artifact.title}</h1>\n        <pre><code class="language-${codeData.language}">${codeData.code}</code></pre>\n        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/plugins/autoloader/prism-autoloader.min.js"></script>
      </body>
      </html>
    `;
    
    return {
      success: true,
      data: new Blob([html], { type: 'text/html' }),
      mimeType: 'text/html'
    };
  }

  private static async exportImageFormat(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    // Mock image format conversion
    const mockImageData = new ArrayBuffer(1024);
    
    return {
      success: true,
      data: new Blob([mockImageData], { type: `image/${options.format}` }),
      mimeType: `image/${options.format}`
    };
  }

  private static async exportImageAsPDF(artifact: Artifact, options: ExportOptions): Promise<ExportResult> {
    // Mock image to PDF conversion
    return {
      success: true,
      data: new Blob(['%PDF-1.4\
% Image Export'], { type: 'application/pdf' }),
      mimeType: 'application/pdf'
    };
  }

  private static async createZipArchive(exports: ExportResult[], filename: string): Promise<ExportResult> {
    // Mock ZIP creation - would use JSZip or similar
    const mockZipData = new ArrayBuffer(2048);
    
    return {
      success: true,
      data: new Blob([mockZipData], { type: 'application/zip' }),
      mimeType: 'application/zip',
      filename
    };
  }

  private static generateFilename(artifact: Artifact, format: ExportFormat): string {
    const baseName = artifact.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${baseName}-${timestamp}.${format}`;
  }

  private static async getTemplate(templateType: string): Promise<any> {
    // Mock template loading
    return {
      type: templateType,
      layout: 'default',
      styles: {}
    };
  }

  private static async processForTemplate(artifact: Artifact, template: any): Promise<any> {
    // Mock template processing
    return artifact.content;
  }

  /**
   * Download exported data
   */
  static downloadExport(result: ExportResult): void {
    if (!result.success || !result.data) {
      throw new Error(result.error || 'No data to download');
    }

    const blob = result.data instanceof Blob ? result.data : new Blob([result.data]);
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename || 'download';
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }
}"