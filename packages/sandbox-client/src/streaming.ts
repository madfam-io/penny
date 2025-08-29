/**
 * Streaming utilities for real-time execution output
 */

import { EventCallback, SandboxEvent, StreamEvent, StreamOptions, StreamBuffer } from './types.js';

export class StreamManager {
  private events: Map<string, EventCallback[]> = new Map();
  private buffer: StreamBuffer = {
    stdout: [],
    stderr: [],
    plots: [],
    variables: {}
  };

  constructor(private options: StreamOptions = {}) {
    this.options = {
      includeStdout: true,
      includeStderr: true,
      includePlots: true,
      includeVariables: true,
      bufferSize: 1000,
      ...options
    };
  }

  // Event subscription
  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const sandboxEvent: SandboxEvent = {
        type: event as any,
        timestamp: new Date().toISOString(),
        data
      };
      callbacks.forEach(callback => callback(sandboxEvent));
    }
  }

  // Stream event handling
  handleStreamEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'stdout':
        if (this.options.includeStdout) {
          this.addToBuffer('stdout', event.data);
          this.emit('stdout', event.data);
        }
        break;

      case 'stderr':
        if (this.options.includeStderr) {
          this.addToBuffer('stderr', event.data);
          this.emit('stderr', event.data);
        }
        break;

      case 'plot':
        if (this.options.includePlots) {
          this.buffer.plots.push(event.data);
          this.trimBuffer('plots');
          this.emit('plot', event.data);
        }
        break;

      case 'variable':
        if (this.options.includeVariables) {
          const varData = event.data;
          this.buffer.variables[varData.name] = varData;
          this.emit('variable', varData);
        }
        break;

      case 'error':
        this.emit('error', event.data);
        break;

      case 'complete':
        this.emit('complete', event.data);
        break;
    }
  }

  // Buffer management
  private addToBuffer(type: 'stdout' | 'stderr', data: string): void {
    this.buffer[type].push(data);
    this.trimBuffer(type);
  }

  private trimBuffer(type: 'stdout' | 'stderr' | 'plots'): void {
    const bufferSize = this.options.bufferSize || 1000;
    const buffer = this.buffer[type];
    
    if (buffer.length > bufferSize) {
      const excess = buffer.length - bufferSize;
      buffer.splice(0, excess);
    }
  }

  getBuffer(): StreamBuffer {
    return {
      stdout: [...this.buffer.stdout],
      stderr: [...this.buffer.stderr],
      plots: [...this.buffer.plots],
      variables: { ...this.buffer.variables }
    };
  }

  getStdout(): string {
    return this.buffer.stdout.join('');
  }

  getStderr(): string {
    return this.buffer.stderr.join('');
  }

  clearBuffer(): void {
    this.buffer.stdout = [];
    this.buffer.stderr = [];
    this.buffer.plots = [];
    this.buffer.variables = {};
  }

  // Stream processing utilities
  processOutput(output: string): string[] {
    // Split output into lines and handle ANSI escape sequences
    return output
      .split(/\r?\n/)
      .map(line => this.stripAnsiCodes(line))
      .filter(line => line.length > 0);
  }

  private stripAnsiCodes(str: string): string {
    // Remove ANSI escape sequences
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  // Variable change detection
  trackVariableChanges(oldVars: Record<string, any>, newVars: Record<string, any>): {
    added: string[];
    modified: string[];
    removed: string[];
  } {
    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    // Check for added and modified variables
    for (const [name, value] of Object.entries(newVars)) {
      if (!(name in oldVars)) {
        added.push(name);
      } else if (JSON.stringify(value) !== JSON.stringify(oldVars[name])) {
        modified.push(name);
      }
    }

    // Check for removed variables
    for (const name of Object.keys(oldVars)) {
      if (!(name in newVars)) {
        removed.push(name);
      }
    }

    return { added, modified, removed };
  }
}

export class ExecutionStream {
  private streamManager: StreamManager;
  private abortController?: AbortController;
  private isActive = false;

  constructor(options?: StreamOptions) {
    this.streamManager = new StreamManager(options);
  }

  // Event subscription methods
  onStdout(callback: (data: string) => void): void {
    this.streamManager.on('stdout', (event) => callback(event.data));
  }

  onStderr(callback: (data: string) => void): void {
    this.streamManager.on('stderr', (event) => callback(event.data));
  }

  onPlot(callback: (plot: any) => void): void {
    this.streamManager.on('plot', (event) => callback(event.data));
  }

  onVariable(callback: (variable: any) => void): void {
    this.streamManager.on('variable', (event) => callback(event.data));
  }

  onError(callback: (error: any) => void): void {
    this.streamManager.on('error', (event) => callback(event.data));
  }

  onComplete(callback: (result: any) => void): void {
    this.streamManager.on('complete', (event) => callback(event.data));
  }

  // Stream control
  start(fetch: (onEvent: (event: StreamEvent) => void) => Promise<any>): Promise<any> {
    if (this.isActive) {
      throw new Error('Stream is already active');
    }

    this.isActive = true;
    this.abortController = new AbortController();

    return new Promise(async (resolve, reject) => {
      try {
        const result = await fetch((event: StreamEvent) => {
          this.streamManager.handleStreamEvent(event);
        });
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.isActive = false;
        this.abortController = undefined;
      }
    });
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  isRunning(): boolean {
    return this.isActive;
  }

  // Buffer access
  getOutput(): string {
    return this.streamManager.getStdout();
  }

  getErrors(): string {
    return this.streamManager.getStderr();
  }

  getPlots(): any[] {
    return this.streamManager.getBuffer().plots;
  }

  getVariables(): Record<string, any> {
    return this.streamManager.getBuffer().variables;
  }

  clear(): void {
    this.streamManager.clearBuffer();
  }
}

// Utility functions for stream processing
export function createStreamProcessor(options?: StreamOptions): StreamManager {
  return new StreamManager(options);
}

export function parseServerSentEvent(data: string): StreamEvent | null {
  if (!data.startsWith('data: ')) {
    return null;
  }

  try {
    return JSON.parse(data.slice(6));
  } catch {
    return null;
  }
}

export function formatStreamOutput(buffer: StreamBuffer): string {
  const sections: string[] = [];

  // Add stdout
  if (buffer.stdout.length > 0) {
    sections.push('=== Output ===');
    sections.push(buffer.stdout.join(''));
  }

  // Add stderr
  if (buffer.stderr.length > 0) {
    sections.push('=== Errors ===');
    sections.push(buffer.stderr.join(''));
  }

  // Add variable summary
  const varCount = Object.keys(buffer.variables).length;
  if (varCount > 0) {
    sections.push(`=== Variables (${varCount}) ===`);
    for (const [name, data] of Object.entries(buffer.variables)) {
      sections.push(`${name}: ${data.type}`);
    }
  }

  // Add plot summary
  if (buffer.plots.length > 0) {
    sections.push(`=== Plots (${buffer.plots.length}) ===`);
    buffer.plots.forEach((plot, index) => {
      sections.push(`Plot ${index + 1}: ${plot.format} (${plot.metadata?.title || 'untitled'})`);
    });
  }

  return sections.join('\n');
}

export class OutputCollector {
  private stdout: string[] = [];
  private stderr: string[] = [];
  private plots: any[] = [];
  private variables: Record<string, any> = {};

  collect(event: StreamEvent): void {
    switch (event.type) {
      case 'stdout':
        this.stdout.push(event.data);
        break;
      case 'stderr':
        this.stderr.push(event.data);
        break;
      case 'plot':
        this.plots.push(event.data);
        break;
      case 'variable':
        this.variables[event.data.name] = event.data;
        break;
    }
  }

  getStdout(): string {
    return this.stdout.join('');
  }

  getStderr(): string {
    return this.stderr.join('');
  }

  getPlots(): any[] {
    return [...this.plots];
  }

  getVariables(): Record<string, any> {
    return { ...this.variables };
  }

  clear(): void {
    this.stdout = [];
    this.stderr = [];
    this.plots = [];
    this.variables = {};
  }

  isEmpty(): boolean {
    return this.stdout.length === 0 && 
           this.stderr.length === 0 && 
           this.plots.length === 0 && 
           Object.keys(this.variables).length === 0;
  }
}

export default {
  StreamManager,
  ExecutionStream,
  createStreamProcessor,
  parseServerSentEvent,
  formatStreamOutput,
  OutputCollector
};