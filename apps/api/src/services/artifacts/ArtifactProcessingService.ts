import { Artifact } from '@penny/types';

export interface ProcessingResult {
  success: boolean;
  processedArtifact?: Artifact;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface ExportOptions {
  format: string;
  quality?: number;
  compression?: boolean;
  includeMeta?: boolean;
  customOptions?: Record<string, any>;
}

export class ArtifactProcessingService {
  async processArtifact(artifact: Artifact): Promise<Artifact> {
    try {
      const processor = this.getProcessor(artifact.type);
      const result = await processor.process(artifact);
      
      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      return result.processedArtifact!;
    } catch (error) {
      console.error('Artifact processing failed:', error);
      throw error;
    }
  }

  async exportArtifact(artifact: Artifact, format: string, options: ExportOptions = { format }): Promise<Buffer> {
    const exporter = this.getExporter(artifact.type, format);
    return await exporter.export(artifact, options);
  }

  async validateArtifact(artifact: Artifact): Promise<{ isValid: boolean; errors: string[] }> {
    const validator = this.getValidator(artifact.type);
    return await validator.validate(artifact);
  }

  private getProcessor(type: string): ArtifactProcessor {
    switch (type) {
      case 'chart':
        return new ChartProcessor();
      case 'table':
        return new TableProcessor();
      case 'code':
        return new CodeProcessor();
      case 'image':
        return new ImageProcessor();
      case 'video':
        return new VideoProcessor();
      case 'audio':
        return new AudioProcessor();
      case 'pdf':
        return new PDFProcessor();
      case 'json':
        return new JSONProcessor();
      case 'html':
        return new HTMLProcessor();
      case 'markdown':
        return new MarkdownProcessor();
      case 'map':
        return new MapProcessor();
      case 'model':
        return new ModelProcessor();
      default:
        return new DefaultProcessor();
    }
  }

  private getExporter(type: string, format: string): ArtifactExporter {
    const key = `${type}_${format}`;
    
    switch (key) {
      // Chart exports
      case 'chart_png':
      case 'chart_svg':
        return new ChartImageExporter();
      case 'chart_pdf':
        return new ChartPDFExporter();
      case 'chart_json':
        return new ChartDataExporter();
      
      // Table exports
      case 'table_csv':
        return new TableCSVExporter();
      case 'table_excel':
        return new TableExcelExporter();
      case 'table_pdf':
        return new TablePDFExporter();
      case 'table_json':
        return new TableJSONExporter();
      
      // Code exports
      case 'code_txt':
        return new CodeTextExporter();
      case 'code_pdf':
        return new CodePDFExporter();
      
      // Image exports
      case 'image_png':
      case 'image_jpg':
      case 'image_webp':
        return new ImageFormatExporter();
      
      // Default JSON export
      default:
        return new JSONExporter();
    }
  }

  private getValidator(type: string): ArtifactValidator {
    switch (type) {
      case 'chart':
        return new ChartValidator();
      case 'table':
        return new TableValidator();
      case 'json':
        return new JSONValidator();
      case 'html':
        return new HTMLValidator();
      default:
        return new DefaultValidator();
    }
  }
}

// Base interfaces
interface ArtifactProcessor {
  process(artifact: Artifact): Promise<ProcessingResult>;
}

interface ArtifactExporter {
  export(artifact: Artifact, options: ExportOptions): Promise<Buffer>;
}

interface ArtifactValidator {
  validate(artifact: Artifact): Promise<{ isValid: boolean; errors: string[] }>;
}

// Chart Processor
class ChartProcessor implements ArtifactProcessor {
  async process(artifact: Artifact): Promise<ProcessingResult> {
    try {
      const chartData = artifact.content;
      
      // Validate chart data structure
      if (!chartData.chartType || !chartData.data) {
        return {
          success: false,
          error: 'Invalid chart data structure'
        };
      }

      // Process chart data
      const processedData = {
        ...chartData,
        data: this.processChartData(chartData.data),
        config: {
          ...chartData.config,
          responsive: true,
          maintainAspectRatio: false
        }
      };

      return {
        success: true,
        processedArtifact: {
          ...artifact,
          content: processedData,
          metadata: {
            ...artifact.metadata,
            dataPoints: chartData.data.length,
            chartType: chartData.chartType,
            processedAt: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chart processing failed'
      };
    }
  }

  private processChartData(data: any[]): any[] {
    // Validate and clean chart data
    return data.filter(item => item != null).map(item => {
      // Ensure numeric values are properly typed
      const processed = { ...item };
      Object.keys(processed).forEach(key => {
        if (typeof processed[key] === 'string' && !isNaN(Number(processed[key]))) {
          processed[key] = Number(processed[key]);
        }
      });
      return processed;
    });
  }
}

// Table Processor
class TableProcessor implements ArtifactProcessor {
  async process(artifact: Artifact): Promise<ProcessingResult> {
    try {
      const tableData = artifact.content;
      
      if (!tableData.columns || !tableData.data) {
        return {
          success: false,
          error: 'Invalid table data structure'
        };
      }

      // Validate columns
      const validatedColumns = tableData.columns.map((col: any) => ({
        ...col,\n        key: col.key || col.title?.toLowerCase().replace(/\s+/g, '_'),
        sortable: col.sortable !== false,
        filterable: col.filterable !== false
      }));

      // Validate and type data
      const validatedData = tableData.data.map((row: any) => {
        const typedRow: any = {};
        validatedColumns.forEach((col: any) => {
          let value = row[col.key];
          
          // Type conversion based on column type
          switch (col.type) {
            case 'number':
              value = value != null ? Number(value) : null;
              break;
            case 'boolean':
              value = value != null ? Boolean(value) : null;
              break;
            case 'date':
              value = value != null ? new Date(value) : null;
              break;
            default:
              value = value != null ? String(value) : null;
          }
          
          typedRow[col.key] = value;
        });
        return typedRow;
      });

      return {
        success: true,
        processedArtifact: {
          ...artifact,
          content: {
            ...tableData,
            columns: validatedColumns,
            data: validatedData
          },
          metadata: {
            ...artifact.metadata,
            rowCount: validatedData.length,
            columnCount: validatedColumns.length,
            processedAt: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Table processing failed'
      };
    }
  }
}

// Default processor for simple artifacts
class DefaultProcessor implements ArtifactProcessor {
  async process(artifact: Artifact): Promise<ProcessingResult> {
    return {
      success: true,
      processedArtifact: {
        ...artifact,
        metadata: {
          ...artifact.metadata,
          processedAt: new Date().toISOString()
        }
      }
    };
  }
}

// Other processors (simplified implementations)
class CodeProcessor extends DefaultProcessor {}
class ImageProcessor extends DefaultProcessor {}
class VideoProcessor extends DefaultProcessor {}
class AudioProcessor extends DefaultProcessor {}
class PDFProcessor extends DefaultProcessor {}
class JSONProcessor extends DefaultProcessor {}
class HTMLProcessor extends DefaultProcessor {}
class MarkdownProcessor extends DefaultProcessor {}
class MapProcessor extends DefaultProcessor {}
class ModelProcessor extends DefaultProcessor {}

// Exporters
class ChartImageExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    // Mock chart image generation
    const mockImageData = Buffer.from('mock-chart-image-data');
    return mockImageData;
  }
}

class ChartPDFExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    // Mock chart PDF generation
    return Buffer.from('mock-chart-pdf-data');
  }
}

class ChartDataExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    const chartData = artifact.content;
    return Buffer.from(JSON.stringify(chartData.data, null, 2));
  }
}

class TableCSVExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    const tableData = artifact.content;
    const { columns, data } = tableData;
    
    // Generate CSV\n    const headers = columns.map((col: any) => col.title).join(',');
    const rows = data.map((row: any) => 
      columns.map((col: any) => {\n        const value = row[col.key] || '';
        return typeof value === 'string' && value.includes(',') \n          ? `"${value.replace(/"/g, '""')}"` 
          : value;\n      }).join(',')
    );
    \n    const csv = [headers, ...rows].join('\
');
    return Buffer.from(csv, 'utf-8');
  }
}

class TableExcelExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    // Mock Excel generation
    return Buffer.from('mock-excel-data');
  }
}

class TablePDFExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    // Mock PDF generation
    return Buffer.from('mock-table-pdf-data');
  }
}

class TableJSONExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    const tableData = artifact.content;
    return Buffer.from(JSON.stringify(tableData.data, null, 2));
  }
}

class CodeTextExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    const codeData = artifact.content;\n    return Buffer.from(codeData.code || '', 'utf-8');
  }
}

class CodePDFExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    // Mock code PDF generation
    return Buffer.from('mock-code-pdf-data');
  }
}

class ImageFormatExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    // Mock image format conversion
    return Buffer.from('mock-image-data');
  }
}

class JSONExporter implements ArtifactExporter {
  async export(artifact: Artifact, options: ExportOptions): Promise<Buffer> {
    const exportData = {
      ...artifact,
      exportedAt: new Date().toISOString(),
      exportFormat: options.format,
      exportOptions: options.customOptions
    };
    
    return Buffer.from(JSON.stringify(exportData, null, 2));
  }
}

// Validators
class ChartValidator implements ArtifactValidator {
  async validate(artifact: Artifact): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const chartData = artifact.content;
    
    if (!chartData.chartType) {
      errors.push('Chart type is required');
    }
    
    if (!chartData.data || !Array.isArray(chartData.data)) {
      errors.push('Chart data must be an array');
    }
    
    if (chartData.data && chartData.data.length === 0) {
      errors.push('Chart data cannot be empty');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

class TableValidator implements ArtifactValidator {
  async validate(artifact: Artifact): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const tableData = artifact.content;
    
    if (!tableData.columns || !Array.isArray(tableData.columns)) {
      errors.push('Table columns must be an array');
    }
    
    if (!tableData.data || !Array.isArray(tableData.data)) {
      errors.push('Table data must be an array');
    }
    
    if (tableData.columns && tableData.columns.length === 0) {
      errors.push('Table must have at least one column');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

class JSONValidator implements ArtifactValidator {
  async validate(artifact: Artifact): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      JSON.stringify(artifact.content);
    } catch (error) {
      errors.push('Invalid JSON content');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

class HTMLValidator implements ArtifactValidator {
  async validate(artifact: Artifact): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const htmlContent = typeof artifact.content === 'string' ? artifact.content : artifact.content?.html;
    
    if (!htmlContent) {
      errors.push('HTML content is required');
    }
    
    // Basic HTML validation\n    if (htmlContent && !htmlContent.includes('<')) {
      errors.push('Content does not appear to be valid HTML');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

class DefaultValidator implements ArtifactValidator {
  async validate(artifact: Artifact): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    if (!artifact.content) {
      errors.push('Artifact content is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }\n}"