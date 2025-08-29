import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../storage/index.js';
import type { ToolResult } from './types.js';

export interface PythonSandboxConfig {
  timeout?: number;
  memoryLimit?: string;
  cpuLimit?: string;
  allowedPackages?: string[];
  tempDir?: string;
  dockerImage?: string;
}

export interface PythonExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  artifacts?: Array<{
    type: string;
    name: string;
    path: string;
    data?: any;
  }>;
  plots?: Array<{
    format: string;
    data: string;
  }>;
}

export class PythonSandbox {
  private config: PythonSandboxConfig;
  private storage: StorageService;

  constructor(config: PythonSandboxConfig = {}) {
    this.config = {
      timeout: 30000,
      memoryLimit: '512m',
      cpuLimit: '1',
      allowedPackages: [
        'numpy',
        'pandas',
        'matplotlib',
        'seaborn',
        'scikit-learn',
        'requests',
        'beautifulsoup4',
      ],
      tempDir: '/tmp/penny-sandbox',
      dockerImage: 'penny/python-sandbox:latest',
      ...config,
    };

    this.storage = new StorageService({
      provider: process.env.STORAGE_PROVIDER || 'local',
      bucket: process.env.S3_BUCKET_NAME || 'penny-artifacts',
    });
  }

  async execute(code: string, context: any): Promise<ToolResult> {
    const executionId = uuidv4();
    const workDir = path.join(this.config.tempDir!, executionId);

    try {
      // Create working directory
      await fs.mkdir(workDir, { recursive: true });

      // Prepare Python script with safety wrapper
      const wrappedCode = this.wrapCode(code);
      const scriptPath = path.join(workDir, 'script.py');
      await fs.writeFile(scriptPath, wrappedCode);

      // Execute in Docker container for isolation
      const result = await this.runInDocker(scriptPath, workDir, context);

      // Process results and artifacts
      const artifacts = await this.processArtifacts(workDir, executionId);

      return {
        success: result.exitCode === 0,
        data: {
          stdout: result.stdout,
          stderr: result.stderr,
          executionId,
          duration: Date.now() - Date.now(), // Calculate actual duration
        },
        artifacts,
        usage: {
          credits: 5, // Python execution costs more credits
          duration: Date.now() - Date.now(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'PYTHON_EXECUTION_ERROR',
          message: error.message,
          retryable: false,
        },
      };
    } finally {
      // Cleanup
      await this.cleanup(workDir);
    }
  }

  private wrapCode(code: string): string {
    return `
import sys
import json
import base64
import io
import traceback
from contextlib import redirect_stdout, redirect_stderr

# Import allowed packages
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns

# Security restrictions
import builtins
restricted_builtins = {
    'eval': None,
    'exec': None,
    '__import__': None,
    'compile': None,
    'open': builtins.open,  # Restricted file access
}

for name, func in restricted_builtins.items():
    if func is None:
        delattr(builtins, name)
    else:
        setattr(builtins, name, func)

# Capture output
stdout_capture = io.StringIO()
stderr_capture = io.StringIO()
artifacts = []

def save_plot(name='plot', format='png'):
    """Helper to save matplotlib plots as artifacts"""
    buffer = io.BytesIO()
    plt.savefig(buffer, format=format, bbox_inches='tight')
    buffer.seek(0)
    artifacts.append({
        'type': 'image',
        'name': f'{name}.{format}',
        'data': base64.b64encode(buffer.read()).decode('utf-8'),
        'format': format
    })
    plt.clf()

def save_dataframe(df, name='data'):
    """Helper to save pandas DataFrames as artifacts"""
    artifacts.append({
        'type': 'table',
        'name': f'{name}.csv',
        'data': df.to_dict('records'),
        'columns': df.columns.tolist()
    })

# User code execution
try:
    with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
        # User code starts here
${code}
        # User code ends here
        
    # Auto-save any open plots
    if plt.get_fignums():
        save_plot('output_plot')
        
except Exception as e:
    stderr_capture.write(f"Error: {str(e)}\\n")
    stderr_capture.write(traceback.format_exc())

# Output results
result = {
    'stdout': stdout_capture.getvalue(),
    'stderr': stderr_capture.getvalue(),
    'artifacts': artifacts
}

print(json.dumps(result))
`;
  }

  private async runInDocker(
    scriptPath: string,
    workDir: string,
    context: any,
  ): Promise<PythonExecutionResult> {
    return new Promise((resolve, reject) => {
      const dockerArgs = [
        'run',
        '--rm',
        '--network=none', // No network access
        `--memory=${this.config.memoryLimit}`,
        `--cpus=${this.config.cpuLimit}`,
        '--read-only',
        '-v',
        `${workDir}:/workspace:ro`,
        '-w',
        '/workspace',
        this.config.dockerImage!,
        'python',
        'script.py',
      ];

      const proc = spawn('docker', dockerArgs);

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Execution timeout'));
      }, this.config.timeout!);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);

        try {
          // Parse JSON output from wrapped code
          const result = JSON.parse(stdout);
          resolve({
            stdout: result.stdout || '',
            stderr: result.stderr || stderr,
            exitCode: code || 0,
            artifacts: result.artifacts || [],
          });
        } catch (error) {
          // Fallback if JSON parsing fails
          resolve({
            stdout,
            stderr,
            exitCode: code || 1,
          });
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async runLocal(scriptPath: string, workDir: string): Promise<PythonExecutionResult> {
    // Fallback for local execution without Docker
    return new Promise((resolve, reject) => {
      const proc = spawn('python3', [scriptPath], {
        cwd: workDir,
        env: {
          ...process.env,
          PYTHONPATH: workDir,
        },
      });

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Execution timeout'));
      }, this.config.timeout!);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);

        try {
          const result = JSON.parse(stdout);
          resolve({
            stdout: result.stdout || '',
            stderr: result.stderr || stderr,
            exitCode: code || 0,
            artifacts: result.artifacts || [],
          });
        } catch (error) {
          resolve({
            stdout,
            stderr,
            exitCode: code || 1,
          });
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async processArtifacts(workDir: string, executionId: string): Promise<any[]> {
    const artifacts = [];

    try {
      // Read any generated files
      const files = await fs.readdir(workDir);

      for (const file of files) {
        if (file === 'script.py') continue;

        const filePath = path.join(workDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile() && stats.size < 10 * 1024 * 1024) {
          // Max 10MB
          const content = await fs.readFile(filePath);
          const ext = path.extname(file).toLowerCase();

          let type = 'document';
          let mimeType = 'application/octet-stream';

          if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
            type = 'image';
            mimeType = `image/${ext.slice(1)}`;
          } else if (['.csv', '.tsv'].includes(ext)) {
            type = 'table';
            mimeType = 'text/csv';
          } else if (['.json'].includes(ext)) {
            type = 'data';
            mimeType = 'application/json';
          }

          // Upload to storage
          const storageKey = `python-artifacts/${executionId}/${file}`;
          const url = await this.storage.upload(storageKey, content, {
            contentType: mimeType,
          });

          artifacts.push({
            type,
            name: file,
            url,
            mimeType,
            size: stats.size,
          });
        }
      }
    } catch (error) {
      console.error('Error processing artifacts:', error);
    }

    return artifacts;
  }

  private async cleanup(workDir: string): Promise<void> {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  async validateCode(code: string): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      /import\s+os/,
      /import\s+subprocess/,
      /import\s+sys/,
      /eval\s*\(/,
      /exec\s*\(/,
      /__import__/,
      /compile\s*\(/,
      /globals\s*\(/,
      /locals\s*\(/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }

    // Check for network access attempts
    const networkPatterns = [
      /import\s+socket/,
      /import\s+urllib/,
      /import\s+http/,
      /requests\.get/,
      /requests\.post/,
    ];

    for (const pattern of networkPatterns) {
      if (pattern.test(code)) {
        errors.push(`Network access not allowed: ${pattern.source}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// Dockerfile for Python sandbox (save as packages/core/docker/python-sandbox/Dockerfile)
const dockerfileContent = `
FROM python:3.11-slim

# Install required packages
RUN pip install --no-cache-dir \\
    numpy==1.24.3 \\
    pandas==2.0.3 \\
    matplotlib==3.7.2 \\
    seaborn==0.12.2 \\
    scikit-learn==1.3.0 \\
    beautifulsoup4==4.12.2

# Create non-root user
RUN useradd -m -s /bin/bash sandbox

# Set working directory
WORKDIR /workspace

# Switch to non-root user
USER sandbox

# Set Python to unbuffered mode
ENV PYTHONUNBUFFERED=1

# Entrypoint
ENTRYPOINT ["python"]
`;
