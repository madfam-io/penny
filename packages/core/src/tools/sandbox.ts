import { Worker } from 'worker_threads';
import { VM } from 'vm2';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ToolDefinition, ToolContext, ToolResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SandboxConfig {
  timeout?: number;
  memory?: number;
  allowedModules?: string[];
}

export class ToolSandbox {
  private config: SandboxConfig;

  constructor(config: SandboxConfig = {}) {
    this.config = {
      timeout: 30000,
      memory: 128,
      allowedModules: ['lodash', 'dayjs', 'axios'],
      ...config,
    };
  }

  async execute(tool: ToolDefinition, params: any, context: ToolContext): Promise<ToolResult> {
    // For now, use VM2 for JavaScript execution
    // In production, consider using Docker containers or WebAssembly
    const vm = new VM({
      timeout: this.config.timeout,
      sandbox: {
        params,
        context: {
          tenantId: context.tenantId,
          userId: context.userId,
          conversationId: context.conversationId,
        },
        console: {
          log: (...args: any[]) => console.log('[Sandbox]', ...args),
          error: (...args: any[]) => console.error('[Sandbox]', ...args),
        },
        require: (module: string) => {
          if (!this.config.allowedModules?.includes(module)) {
            throw new Error(`Module ${module} is not allowed`);
          }
          return require(module);
        },
      },
      require: {
        external: this.config.allowedModules,
      },
    });

    try {
      // Wrap the tool handler in a string for VM execution
      const code = `
        (async function() {
          const handler = ${tool.handler.toString()};
          return await handler(params, context);
        })()
      `;

      const result = await vm.run(code);
      return result;
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'SANDBOX_ERROR',
          message: error.message,
          retryable: false,
        },
      };
    }
  }

  async executeInWorker(
    tool: ToolDefinition,
    params: any,
    context: ToolContext,
  ): Promise<ToolResult> {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, 'worker.js');
      const worker = new Worker(workerPath);

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker timeout'));
      }, this.config.timeout!);

      worker.on('message', (result: ToolResult) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(result);
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(error);
      });

      worker.postMessage({
        tool: {
          name: tool.name,
          handler: tool.handler.toString(),
        },
        params,
        context,
      });
    });
  }
}
