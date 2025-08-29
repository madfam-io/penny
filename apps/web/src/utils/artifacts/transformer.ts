import { Artifact, ChartArtifact, TableArtifact, CodeArtifact } from '@penny/types';

export interface TransformOptions {
  preserveMetadata?: boolean;
  validateOutput?: boolean;
  includeSourceInfo?: boolean;
}

export interface TransformResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  sourceType?: Artifact['type'];
  targetType?: Artifact['type'];
}

export class ArtifactTransformer {
  /**
   * Transform data to chart format
   */
  static toChart(data: any, options: TransformOptions = {}): TransformResult<ChartArtifact['content']> {
    try {
      // If already a chart, return as is
      if (data.chartType && data.data) {
        return { success: true, data };
      }

      // Transform table to chart
      if (Array.isArray(data.columns) && Array.isArray(data.data)) {
        return this.tableToChart(data, options);
      }

      // Transform array of objects to chart
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        return this.arrayToChart(data, options);
      }

      // Transform CSV string to chart
      if (typeof data === 'string' && data.includes(',')) {
        const parsed = this.parseCSV(data);
        return this.arrayToChart(parsed, options);
      }

      return {
        success: false,
        error: 'Unable to transform data to chart format'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transformation failed'
      };
    }
  }

  /**
   * Transform data to table format
   */
  static toTable(data: any, options: TransformOptions = {}): TransformResult<TableArtifact['content']> {
    try {
      // If already a table, return as is
      if (data.columns && data.data) {
        return { success: true, data };
      }

      // Transform chart to table
      if (data.chartType && data.data) {
        return this.chartToTable(data, options);
      }

      // Transform array of objects to table
      if (Array.isArray(data) && data.length > 0) {
        return this.arrayToTable(data, options);
      }

      // Transform CSV string to table
      if (typeof data === 'string' && data.includes(',')) {
        const parsed = this.parseCSV(data);
        return this.arrayToTable(parsed, options);
      }

      // Transform JSON object to table (flatten)
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const flattened = this.flattenObject(data);
        const tableData = Object.entries(flattened).map(([key, value]) => ({
          property: key,
          value: String(value),
          type: typeof value
        }));
        
        return {
          success: true,
          data: {
            columns: [
              { key: 'property', title: 'Property', type: 'string' as const, sortable: true, filterable: true },
              { key: 'value', title: 'Value', type: 'string' as const, sortable: true, filterable: true },
              { key: 'type', title: 'Type', type: 'string' as const, sortable: true, filterable: true }
            ],
            data: tableData,
            config: {
              pagination: { enabled: true, pageSize: 25, showSizeChanger: true },
              sorting: { enabled: true },
              filtering: { enabled: true, searchable: true },
              selection: { enabled: false, multiple: false },
              export: { enabled: true, formats: ['csv' as const] }
            }
          }
        };
      }

      return {
        success: false,
        error: 'Unable to transform data to table format'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transformation failed'
      };
    }
  }

  /**
   * Transform data to code format
   */
  static toCode(data: any, language = 'javascript', options: TransformOptions = {}): TransformResult<CodeArtifact['content']> {
    try {
      // If already code, return as is
      if (typeof data === 'object' && data.code && data.language) {
        return { success: true, data };
      }

      let code: string;
      let detectedLanguage = language;

      if (typeof data === 'string') {
        code = data;
      } else if (typeof data === 'object') {
        code = JSON.stringify(data, null, 2);
        detectedLanguage = 'json';
      } else {
        code = String(data);
      }

      return {
        success: true,
        data: {
          code,
          language: detectedLanguage,
          config: {
            theme: 'light' as const,
            showLineNumbers: true,
            wordWrap: false,
            fontSize: 14,
            tabSize: 2,
            readOnly: true,
            showMinimap: false,
            folding: true
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transformation failed'
      };
    }
  }

  /**
   * Transform to CSV format
   */
  static toCSV(data: any, options: TransformOptions = {}): TransformResult<string> {
    try {
      let tableData: any;

      if (data.columns && data.data) {
        // Already table format
        tableData = data;
      } else if (Array.isArray(data) && data.length > 0) {
        // Array of objects
        const result = this.arrayToTable(data, options);
        if (!result.success || !result.data) {
          return { success: false, error: 'Failed to convert to table format' };
        }
        tableData = result.data;
      } else {
        return { success: false, error: 'Data cannot be converted to CSV' };
      }

      const headers = tableData.columns.map((col: any) => col.title || col.key).join(',');
      const rows = tableData.data.map((row: any) => 
        tableData.columns.map((col: any) => {
          const value = row[col.key] || '';
          // Escape CSV values
          if (typeof value === 'string' && (value.includes(',') || value.includes('\"') || value.includes('\\n'))) {
            return `\"${value.replace(/\"/g, '\"\"')}\"`;
          }
          return value;
        }).join(',')
      );

      const csv = [headers, ...rows].join('\\n');
      return { success: true, data: csv };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CSV transformation failed'
      };
    }
  }

  /**
   * Transform between any two artifact types
   */
  static transform(
    data: any, 
    fromType: Artifact['type'], 
    toType: Artifact['type'], 
    options: TransformOptions = {}
  ): TransformResult {
    if (fromType === toType) {
      return { success: true, data, sourceType: fromType, targetType: toType };
    }

    switch (toType) {
      case 'chart':
        return { ...this.toChart(data, options), sourceType: fromType, targetType: toType };
      case 'table':
        return { ...this.toTable(data, options), sourceType: fromType, targetType: toType };
      case 'code':
        return { ...this.toCode(data, 'javascript', options), sourceType: fromType, targetType: toType };
      case 'json':
        return this.toJSON(data, options);
      default:
        return {
          success: false,
          error: `Transformation from ${fromType} to ${toType} is not supported`,
          sourceType: fromType,
          targetType: toType
        };
    }
  }

  private static tableToChart(tableData: any, options: TransformOptions): TransformResult {
    const { columns, data } = tableData;
    
    if (!columns || !data || data.length === 0) {
      return { success: false, error: 'Invalid table data for chart conversion' };
    }

    // Find numeric and categorical columns
    const numericColumns = columns.filter((col: any) => col.type === 'number');
    const categoryColumn = columns.find((col: any) => col.type === 'string');

    if (numericColumns.length === 0) {
      return { success: false, error: 'No numeric columns found for chart' };
    }

    // Determine chart type based on data structure
    let chartType = 'bar';
    if (numericColumns.length === 1 && categoryColumn) {
      chartType = 'bar';
    } else if (numericColumns.length === 2) {
      chartType = 'scatter';
    } else if (numericColumns.length > 2) {
      chartType = 'line';
    }

    return {
      success: true,
      data: {
        chartType,
        data,
        config: {
          title: 'Converted Chart',
          xAxis: categoryColumn ? { label: categoryColumn.title, type: 'category' as const } : undefined,
          yAxis: { label: numericColumns[0].title, type: 'value' as const },
          colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'],
          legend: true,
          tooltip: true,
          responsive: true,
          animations: true
        }
      }
    };
  }

  private static chartToTable(chartData: any, options: TransformOptions): TransformResult {
    const { data } = chartData;
    
    if (!data || !Array.isArray(data)) {
      return { success: false, error: 'Invalid chart data for table conversion' };
    }

    if (data.length === 0) {
      return { success: false, error: 'Empty chart data' };
    }

    // Generate columns from first data item
    const sampleItem = data[0];
    const columns = Object.keys(sampleItem).map(key => ({
      key,
      title: key.charAt(0).toUpperCase() + key.slice(1),
      type: this.inferColumnType(data, key),
      sortable: true,
      filterable: true
    }));

    return {
      success: true,
      data: {
        columns,
        data,
        config: {
          pagination: { enabled: true, pageSize: 25, showSizeChanger: true },
          sorting: { enabled: true },
          filtering: { enabled: true, searchable: true },
          selection: { enabled: false, multiple: false },
          export: { enabled: true, formats: ['csv' as const, 'excel' as const] }
        }
      }
    };
  }

  private static arrayToChart(data: any[], options: TransformOptions): TransformResult {
    if (data.length === 0) {
      return { success: false, error: 'Empty data array' };
    }

    const sampleItem = data[0];
    const keys = Object.keys(sampleItem);
    
    // Find the best columns for charting
    const numericKeys = keys.filter(key => 
      data.every(item => typeof item[key] === 'number' || !isNaN(Number(item[key])))
    );
    
    const categoryKey = keys.find(key => 
      data.every(item => typeof item[key] === 'string' || typeof item[key] === 'number')
    );

    if (numericKeys.length === 0) {
      return { success: false, error: 'No numeric data found for chart' };
    }

    return {
      success: true,
      data: {
        chartType: 'bar' as const,
        data,
        config: {
          title: 'Data Visualization',
          xAxis: categoryKey ? { label: categoryKey, type: 'category' as const } : undefined,
          yAxis: { label: numericKeys[0], type: 'value' as const },
          colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'],
          legend: true,
          tooltip: true,
          responsive: true,
          animations: true
        }
      }
    };
  }

  private static arrayToTable(data: any[], options: TransformOptions): TransformResult {
    if (data.length === 0) {
      return { success: false, error: 'Empty data array' };
    }

    // Handle array of primitives
    if (typeof data[0] !== 'object') {
      const tableData = data.map((value, index) => ({
        index,
        value: String(value),
        type: typeof value
      }));

      return {
        success: true,
        data: {
          columns: [
            { key: 'index', title: 'Index', type: 'number' as const, sortable: true, filterable: true },
            { key: 'value', title: 'Value', type: 'string' as const, sortable: true, filterable: true },
            { key: 'type', title: 'Type', type: 'string' as const, sortable: true, filterable: true }
          ],
          data: tableData,
          config: {
            pagination: { enabled: true, pageSize: 25, showSizeChanger: true },
            sorting: { enabled: true },
            filtering: { enabled: true, searchable: true },
            selection: { enabled: false, multiple: false },
            export: { enabled: true, formats: ['csv' as const] }
          }
        }
      };
    }

    // Handle array of objects
    const allKeys = [...new Set(data.flatMap(item => Object.keys(item)))];
    const columns = allKeys.map(key => ({
      key,
      title: key.charAt(0).toUpperCase() + key.slice(1),
      type: this.inferColumnType(data, key),
      sortable: true,
      filterable: true
    }));

    return {
      success: true,
      data: {
        columns,
        data,
        config: {
          pagination: { enabled: true, pageSize: 25, showSizeChanger: true },
          sorting: { enabled: true },
          filtering: { enabled: true, searchable: true },
          selection: { enabled: false, multiple: false },
          export: { enabled: true, formats: ['csv' as const, 'excel' as const, 'pdf' as const] }
        }
      }
    };
  }

  private static toJSON(data: any, options: TransformOptions): TransformResult {
    try {
      const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
      return { success: true, data: jsonData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'JSON transformation failed'
      };
    }
  }

  private static parseCSV(csvString: string): any[] {
    const lines = csvString.trim().split('\\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        const value = values[index];
        // Try to parse as number
        obj[header] = isNaN(Number(value)) ? value : Number(value);
      });
      return obj;
    });
  }

  private static flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (obj[key] === null || obj[key] === undefined) {
          flattened[newKey] = obj[key];
        } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          Object.assign(flattened, this.flattenObject(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }
    
    return flattened;
  }

  private static inferColumnType(data: any[], key: string): 'string' | 'number' | 'boolean' | 'date' {
    const values = data.map(item => item[key]).filter(v => v != null);
    
    if (values.length === 0) return 'string';

    // Check if all values are boolean
    if (values.every(v => typeof v === 'boolean')) {
      return 'boolean';
    }

    // Check if all values are numbers
    if (values.every(v => typeof v === 'number' || !isNaN(Number(v)))) {
      return 'number';
    }

    // Check if all values are dates
    if (values.every(v => !isNaN(Date.parse(v)))) {
      return 'date';
    }

    return 'string';
  }

  /**
   * Batch transform multiple artifacts
   */
  static batchTransform(
    artifacts: { data: any; fromType: Artifact['type'] }[],
    toType: Artifact['type'],
    options: TransformOptions = {}
  ): TransformResult[] {
    return artifacts.map(({ data, fromType }) => 
      this.transform(data, fromType, toType, options)
    );
  }

  /**
   * Check if transformation is possible
   */
  static canTransform(fromType: Artifact['type'], toType: Artifact['type']): boolean {
    if (fromType === toType) return true;

    const supportedTransformations: Record<Artifact['type'], Artifact['type'][]> = {
      'table': ['chart', 'code', 'json'],
      'chart': ['table', 'code', 'json'],
      'json': ['table', 'chart', 'code'],
      'code': ['json'],
      'text': ['code'],
      'csv': ['table', 'chart'],
      'markdown': ['html', 'code'],
      'html': ['code'],
      'image': [],
      'video': [],
      'audio': [],
      'pdf': [],
      'map': ['json'],
      'model': []
    };

    return supportedTransformations[fromType]?.includes(toType) || false;
  }
}