import { EventEmitter } from 'events';
import { Transform, Readable, Writable } from 'stream';

export interface OutputChunk {
  type: 'stdout' | 'stderr' | 'plot' | 'variable' | 'error';
  data: any;
  timestamp: Date;
  sequence: number;
}

export interface PlotData {
  id: string;
  format: 'png' | 'svg' | 'html';
  data: string; // base64 encoded or raw data
  metadata: {
    width: number;
    height: number;
    title?: string;
    xlabel?: string;
    ylabel?: string;
  };
}

export interface VariableData {
  name: string;
  type: string;
  value: any;
  shape?: number[];
  dtype?: string;
  preview?: string;
  size?: number;
}

export class OutputCapture extends EventEmitter {
  private sequence = 0;
  private buffer: OutputChunk[] = [];
  private maxBufferSize = 1000;
  private stdoutTransform: Transform;
  private stderrTransform: Transform;

  constructor() {
    super();
    
    this.stdoutTransform = this.createTransform('stdout');
    this.stderrTransform = this.createTransform('stderr');
  }

  createTransform(type: 'stdout' | 'stderr'): Transform {
    return new Transform({
      objectMode: false,
      transform: (chunk: Buffer, encoding, callback) => {
        const data = chunk.toString();
        const outputChunk: OutputChunk = {
          type,
          data,
          timestamp: new Date(),
          sequence: this.sequence++
        };

        this.addToBuffer(outputChunk);
        this.emit('output', outputChunk);
        
        callback(null, chunk); // Pass through original data
      }
    });
  }

  getStdoutTransform(): Transform {
    return this.stdoutTransform;
  }

  getStderrTransform(): Transform {
    return this.stderrTransform;
  }

  captureOutput(stdout: Readable, stderr: Readable): void {
    stdout.pipe(this.stdoutTransform);
    stderr.pipe(this.stderrTransform);
  }

  addPlot(plotData: PlotData): void {
    const outputChunk: OutputChunk = {
      type: 'plot',
      data: plotData,
      timestamp: new Date(),
      sequence: this.sequence++
    };

    this.addToBuffer(outputChunk);
    this.emit('output', outputChunk);
  }

  addVariable(variableData: VariableData): void {
    const outputChunk: OutputChunk = {
      type: 'variable',
      data: variableData,
      timestamp: new Date(),
      sequence: this.sequence++
    };

    this.addToBuffer(outputChunk);
    this.emit('output', outputChunk);
  }

  addError(error: Error | string): void {
    const errorData = typeof error === 'string' ? error : {
      name: error.name,
      message: error.message,
      stack: error.stack
    };

    const outputChunk: OutputChunk = {
      type: 'error',
      data: errorData,
      timestamp: new Date(),
      sequence: this.sequence++
    };

    this.addToBuffer(outputChunk);
    this.emit('output', outputChunk);
  }

  getBuffer(): OutputChunk[] {
    return [...this.buffer];
  }

  clearBuffer(): void {
    this.buffer = [];
    this.sequence = 0;
  }

  getOutput(type?: OutputChunk['type']): OutputChunk[] {
    if (type) {
      return this.buffer.filter(chunk => chunk.type === type);
    }
    return [...this.buffer];
  }

  getOutputAsString(type: 'stdout' | 'stderr' = 'stdout'): string {
    return this.buffer
      .filter(chunk => chunk.type === type)
      .map(chunk => chunk.data)
      .join('');
  }

  getPlots(): PlotData[] {
    return this.buffer
      .filter(chunk => chunk.type === 'plot')
      .map(chunk => chunk.data as PlotData);
  }

  getVariables(): VariableData[] {
    return this.buffer
      .filter(chunk => chunk.type === 'variable')
      .map(chunk => chunk.data as VariableData);
  }

  private addToBuffer(chunk: OutputChunk): void {
    this.buffer.push(chunk);
    
    // Trim buffer if it exceeds max size
    if (this.buffer.length > this.maxBufferSize) {
      const excess = this.buffer.length - this.maxBufferSize;
      this.buffer.splice(0, excess);
    }
  }

  // Stream output to a writable stream
  streamTo(stream: Writable, filter?: (chunk: OutputChunk) => boolean): void {
    const writeChunk = (chunk: OutputChunk) => {
      if (!filter || filter(chunk)) {
        stream.write(JSON.stringify(chunk) + '
');
      }
    };

    // Write existing buffer
    this.buffer.forEach(writeChunk);

    // Listen for new output
    this.on('output', writeChunk);
  }

  // Create a readable stream of output
  createReadableStream(filter?: (chunk: OutputChunk) => boolean): Readable {
    let bufferIndex = 0;

    return new Readable({
      objectMode: true,
      read() {
        // Send existing buffer items
        while (bufferIndex < this.buffer.length) {
          const chunk = this.buffer[bufferIndex++];
          if (!filter || filter(chunk)) {
            this.push(chunk);
          }
        }

        // If we've sent all buffer items, we'll need to wait for new ones
        if (bufferIndex >= this.buffer.length) {
          const onOutput = (chunk: OutputChunk) => {
            if (!filter || filter(chunk)) {
              this.push(chunk);
            }
          };

          this.on('output', onOutput);
          
          // Clean up listener when stream ends
          this.on('end', () => {
            this.removeListener('output', onOutput);
          });
        }
      }
    });
  }

  // Parse and process special output formats
  processSpecialOutput(data: string): void {
    try {
      // Try to parse as JSON (for structured output from Python)
      const parsed = JSON.parse(data);
      
      if (parsed.type === 'plot' && parsed.data) {
        this.addPlot(parsed.data);
        return;
      }
      
      if (parsed.type === 'variable' && parsed.data) {
        this.addVariable(parsed.data);
        return;
      }
      
      if (parsed.type === 'variables' && Array.isArray(parsed.data)) {
        parsed.data.forEach((variable: VariableData) => {
          this.addVariable(variable);
        });
        return;
      }

    } catch (error) {
      // Not JSON, treat as regular output
      // Check for matplotlib plot markers
      if (data.includes('Figure(')) {
        this.parseMatplotlibOutput(data);
        return;
      }

      // Check for pandas DataFrame output
      if (data.includes('DataFrame') || data.match(/\s+\w+\s+\w+
-+\s+-+/)) {
        this.parsePandasOutput(data);
        return;
      }
    }
  }

  private parseMatplotlibOutput(data: string): void {
    // Extract plot information from matplotlib output
    const plotMatch = data.match(/Figure\((\d+)x(\d+)\)/);
    if (plotMatch) {
      const plotData: PlotData = {
        id: `plot-${Date.now()}`,
        format: 'png',
        data: '', // Would be filled by actual plot data
        metadata: {
          width: parseInt(plotMatch[1]),
          height: parseInt(plotMatch[2])
        }
      };
      this.addPlot(plotData);
    }
  }

  private parsePandasOutput(data: string): void {
    // Parse pandas DataFrame/Series output\n    const lines = data.split('
');
    const dataLines = lines.filter(line => line.trim() && !line.includes('---'));
    
    if (dataLines.length > 0) {
      const variableData: VariableData = {
        name: 'DataFrame',
        type: 'pandas.DataFrame',
        value: null, // Original object not available here
        preview: data.substring(0, 500), // First 500 chars
        size: dataLines.length
      };
      this.addVariable(variableData);
    }
  }

  // Utility methods for different output formats
  static formatOutput(chunk: OutputChunk): string {
    switch (chunk.type) {
      case 'stdout':
      case 'stderr':
        return chunk.data;
      
      case 'plot':
        const plot = chunk.data as PlotData;
        return `[Plot: ${plot.id} (${plot.format}, ${plot.metadata.width}x${plot.metadata.height})]`;
      
      case 'variable':
        const variable = chunk.data as VariableData;
        return `[Variable: ${variable.name} = ${variable.preview || variable.value}]`;
      
      case 'error':
        return `[Error: ${chunk.data.message || chunk.data}]`;
      
      default:
        return `[${chunk.type}: ${JSON.stringify(chunk.data)}]`;
    }
  }

  static isPlotOutput(chunk: OutputChunk): boolean {
    return chunk.type === 'plot';
  }

  static isVariableOutput(chunk: OutputChunk): boolean {
    return chunk.type === 'variable';
  }

  static isErrorOutput(chunk: OutputChunk): boolean {
    return chunk.type === 'error';
  }

  // Set maximum buffer size
  setMaxBufferSize(size: number): void {
    this.maxBufferSize = Math.max(100, size); // Minimum 100 entries
    
    // Trim current buffer if needed
    if (this.buffer.length > this.maxBufferSize) {
      const excess = this.buffer.length - this.maxBufferSize;
      this.buffer.splice(0, excess);
    }
  }

  // Get statistics about captured output
  getStats(): {
    totalChunks: number;
    byType: Record<string, number>;
    bufferSize: number;
    oldestTimestamp?: Date;
    newestTimestamp?: Date;
  } {
    const byType: Record<string, number> = {};
    let oldestTimestamp: Date | undefined;
    let newestTimestamp: Date | undefined;

    this.buffer.forEach(chunk => {
      byType[chunk.type] = (byType[chunk.type] || 0) + 1;
      
      if (!oldestTimestamp || chunk.timestamp < oldestTimestamp) {
        oldestTimestamp = chunk.timestamp;
      }
      
      if (!newestTimestamp || chunk.timestamp > newestTimestamp) {
        newestTimestamp = chunk.timestamp;
      }
    });

    return {
      totalChunks: this.buffer.length,
      byType,
      bufferSize: this.buffer.length,
      oldestTimestamp,
      newestTimestamp
    };
  }

  // Clean up resources
  destroy(): void {
    this.clearBuffer();
    this.removeAllListeners();
    
    // Clean up transform streams
    if (this.stdoutTransform) {
      this.stdoutTransform.destroy();
    }
    if (this.stderrTransform) {
      this.stderrTransform.destroy();
    }
  }
}