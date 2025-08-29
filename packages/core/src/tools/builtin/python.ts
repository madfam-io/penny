import { z } from 'zod';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import type { ToolDefinition, ToolHandler } from '../types.js';

const pythonJobSchema = z.object({
  code: z.string(),
  packages: z.array(z.string()).optional(),
  timeout: z.number().min(1000).max(300000).default(60000),
  memory: z.number().min(128).max(2048).default(512),
  env: z.record(z.string()).optional(),
});

const handler: ToolHandler = async (params, context) => {
  const job = pythonJobSchema.parse(params);

  // Create temporary directory for execution
  const tempDir = path.join('/tmp', 'penny-python', randomBytes(16).toString('hex'));
  await fs.mkdir(tempDir, { recursive: true });

  const scriptPath = path.join(tempDir, 'script.py');
  const requirementsPath = path.join(tempDir, 'requirements.txt');

  try {
    // Write script
    await fs.writeFile(scriptPath, job.code);

    // Install packages if specified
    if (job.packages && job.packages.length > 0) {
      await fs.writeFile(requirementsPath, job.packages.join('\n'));

      await new Promise<void>((resolve, reject) => {
        const pip = spawn('pip', ['install', '-r', requirementsPath, '--target', tempDir], {
          cwd: tempDir,
          timeout: 30000,
        });

        pip.on('error', reject);
        pip.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`pip install failed with code ${code}`));
        });
      });
    }

    // Execute Python script
    return new Promise((resolve) => {
      const outputs: string[] = [];
      const errors: string[] = [];

      const python = spawn('python3', [scriptPath], {
        cwd: tempDir,
        timeout: job.timeout,
        env: {
          ...process.env,
          PYTHONPATH: tempDir,
          ...job.env,
        },
      });

      python.stdout.on('data', (data) => {
        outputs.push(data.toString());
      });

      python.stderr.on('data', (data) => {
        errors.push(data.toString());
      });

      python.on('error', (error) => {
        resolve({
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: error.message,
            retryable: false,
          },
        });
      });

      python.on('exit', (code) => {
        const output = outputs.join('');
        const error = errors.join('');

        if (code === 0) {
          resolve({
            success: true,
            data: {
              output,
              exitCode: code,
            },
            artifacts: output
              ? [
                  {
                    type: 'text',
                    name: 'Python Output',
                    content: output,
                    mimeType: 'text/plain',
                  },
                ]
              : [],
            usage: {
              credits: 5,
              duration: Date.now(),
            },
          });
        } else {
          resolve({
            success: false,
            error: {
              code: 'SCRIPT_ERROR',
              message: `Script exited with code ${code}`,
              details: { output, error },
              retryable: false,
            },
          });
        }
      });
    });
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
};

export const runPythonJobTool: ToolDefinition = {
  name: 'run_python_job',
  displayName: 'Run Python Job',
  description: 'Execute Python code in a sandboxed environment',
  category: 'development',
  icon: 'python',
  schema: pythonJobSchema,
  handler,
  config: {
    requiresAuth: true,
    requiresConfirmation: true,
    requiresSandbox: true,
    permissions: ['tool:python:execute'],
    rateLimit: {
      requests: 20,
      window: 3600,
    },
    timeout: 300000, // 5 minutes max
    cost: 5,
  },
};
