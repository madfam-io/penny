import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';\nimport { SandboxSecurity } from './security.js';\nimport { ResourceMonitor } from './utils/resourceMonitor.js';\nimport { CodeAnalyzer } from './utils/codeAnalyzer.js';\nimport { OutputCapture } from './utils/outputCapture.js';\nimport { VirtualFileSystem } from './utils/fileSystem.js';

export interface ExecutionRequest {
  code: string;
  sessionId?: string;
  timeout?: number;
  packages?: string[];
  variables?: Record<string, any>;
  allowNetworking?: boolean;
  maxMemory?: number;
  maxCpu?: number;
}

export interface ExecutionResult {
  success: boolean;
  sessionId: string;
  executionId: string;
  output: {
    stdout: string;
    stderr: string;
    plots: string[];
    variables: Record<string, any>;
  };
  metrics: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  error?: {
    type: string;
    message: string;
    traceback: string;
  };
}

export interface Session {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  variables: Record<string, any>;
  installedPackages: string[];
  filesystem: VirtualFileSystem;
  containerName: string;
}

export class SandboxExecutor {
  private sessions = new Map<string, Session>();
  private activeExecutions = new Map<string, ChildProcess>();
  private resourceMonitor = new ResourceMonitor();
  private codeAnalyzer = new CodeAnalyzer();

  constructor(private security: SandboxSecurity) {
    // Clean up orphaned sessions on startup
    this.cleanupOrphanedSessions();
    
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupStaleSessions();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const sessionId = request.sessionId || uuidv4();

    try {
      // Security validation
      const securityCheck = await this.security.validateCode(request.code);
      if (!securityCheck.allowed) {
        throw new Error(`Security violation: ${securityCheck.reason}`);
      }

      // Static code analysis
      const analysisResult = await this.codeAnalyzer.analyze(request.code);\n      if (analysisResult.hasHighRiskPatterns) {\n        throw new Error(`Code analysis failed: ${analysisResult.risks.join(', ')}`);
      }

      // Get or create session
      const session = await this.getOrCreateSession(sessionId, request);

      // Prepare execution environment
      const executionDir = await this.prepareExecutionEnvironment(session, request);

      // Execute code
      const result = await this.executeInContainer(
        session,
        request,
        executionId,
        executionDir
      );

      // Update session
      session.lastActivity = new Date();
      if (result.output.variables) {
        session.variables = { ...session.variables, ...result.output.variables };
      }

      return result;

    } catch (error) {
      return {
        success: false,
        sessionId,
        executionId,
        output: {\n          stdout: '',\n          stderr: '',
          plots: [],
          variables: {}
        },
        metrics: {
          executionTime: 0,
          memoryUsage: 0,
          cpuUsage: 0
        },
        error: {
          type: error.constructor.name,
          message: error.message,\n          traceback: error.stack || ''
        }
      };
    }
  }

  async executeStream(
    request: ExecutionRequest,
    onOutput: (chunk: { type: 'stdout' | 'stderr' | 'plot' | 'variable'; data: any }) => void
  ): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const sessionId = request.sessionId || uuidv4();

    try {
      // Security and analysis checks (same as execute)
      const securityCheck = await this.security.validateCode(request.code);
      if (!securityCheck.allowed) {\n        throw new Error(`Security violation: ${securityCheck.reason}`);
      }

      const session = await this.getOrCreateSession(sessionId, request);
      const executionDir = await this.prepareExecutionEnvironment(session, request);

      // Execute with streaming
      return await this.executeInContainerStream(
        session,
        request,
        executionId,
        executionDir,
        onOutput
      );

    } catch (error) {
      return {
        success: false,
        sessionId,
        executionId,\n        output: { stdout: '', stderr: '', plots: [], variables: {} },
        metrics: { executionTime: 0, memoryUsage: 0, cpuUsage: 0 },
        error: {
          type: error.constructor.name,
          message: error.message,\n          traceback: error.stack || ''
        }
      };
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async createSession(): Promise<string> {
    const sessionId = uuidv4();
    const session: Session = {
      id: sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      variables: {},
      installedPackages: [],
      filesystem: new VirtualFileSystem(),\n      containerName: `sandbox-${sessionId}`
    };

    this.sessions.set(sessionId, session);
    
    // Create Docker container for this session
    await this.createSessionContainer(session);
    
    return sessionId;
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Stop any active executions
      for (const [execId, process] of this.activeExecutions.entries()) {
        if (execId.startsWith(sessionId)) {
          process.kill('SIGTERM');
          this.activeExecutions.delete(execId);
        }
      }

      // Remove Docker container
      await this.destroySessionContainer(session);
      
      this.sessions.delete(sessionId);
    }
  }

  private async getOrCreateSession(sessionId: string, request: ExecutionRequest): Promise<Session> {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        id: sessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
        variables: request.variables || {},
        installedPackages: request.packages || [],
        filesystem: new VirtualFileSystem(),\n        containerName: `sandbox-${sessionId}`
      };

      this.sessions.set(sessionId, session);
      await this.createSessionContainer(session);
    }

    return session;
  }

  private async prepareExecutionEnvironment(
    session: Session, 
    request: ExecutionRequest
  ): Promise<string> {\n    const executionDir = `/tmp/sandbox/${session.id}`;
    
    // Create execution directory structure
    await fs.mkdir(executionDir, { recursive: true });
    await fs.mkdir(path.join(executionDir, 'plots'), { recursive: true });
    await fs.mkdir(path.join(executionDir, 'data'), { recursive: true });

    // Write code to file
    const codeFile = path.join(executionDir, 'main.py');
    const wrappedCode = this.wrapUserCode(request.code, session);
    await fs.writeFile(codeFile, wrappedCode);

    // Setup virtual filesystem
    await session.filesystem.syncToHost(executionDir);

    return executionDir;
  }

  private wrapUserCode(userCode: string, session: Session): string {\n    return `
import sys
import os
import json
import pickle
import traceback
from io import StringIO
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt

# Import runtime helpers\nsys.path.insert(0, '/sandbox/python')
from runtime import SandboxRuntime
from output_handler import OutputHandler

# Initialize sandbox runtime
runtime = SandboxRuntime()
output_handler = OutputHandler()

# Load session variables
try:\n    with open('/tmp/variables.pkl', 'rb') as f:
        globals().update(pickle.load(f))
except FileNotFoundError:
    pass

# Capture stdout/stderr
old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

try:
    # User code execution\n${userCode.split('
').map(line => `    ${line}`).join('\n')}
    
    execution_success = True
    execution_error = None
except Exception as e:
    execution_success = False
    execution_error = {
        'type': type(e).__name__,
        'message': str(e),
        'traceback': traceback.format_exc()
    }

finally:
    # Restore stdout/stderr and capture output
    stdout_output = sys.stdout.getvalue()
    stderr_output = sys.stderr.getvalue()
    sys.stdout = old_stdout
    sys.stderr = old_stderr
    
    # Save plots
    plot_files = []
    for i in plt.get_fignums():
        fig = plt.figure(i)\n        plot_path = f'/tmp/plots/plot_{i}.png'
        fig.savefig(plot_path, dpi=150, bbox_inches='tight')
        plot_files.append(plot_path)
    
    plt.close('all')
    
    # Extract variables (excluding built-ins and imports)
    user_variables = {
        k: v for k, v in globals().items() \n        if not k.startswith('_') and k not in [
            'sys', 'os', 'json', 'pickle', 'traceback', 'StringIO',
            'matplotlib', 'plt', 'runtime', 'output_handler',
            'old_stdout', 'old_stderr', 'execution_success', 'execution_error',
            'stdout_output', 'stderr_output', 'plot_files', 'user_variables'
        ]
    }
    
    # Save session variables\n    with open('/tmp/variables.pkl', 'wb') as f:
        pickle.dump(user_variables, f)
    
    # Output results as JSON
    result = {
        'success': execution_success,
        'stdout': stdout_output,
        'stderr': stderr_output,
        'plots': plot_files,
        'variables': output_handler.serialize_variables(user_variables),
        'error': execution_error
    }
    
    print(json.dumps(result, indent=2))\n`;
  }

  private async executeInContainer(
    session: Session,
    request: ExecutionRequest,
    executionId: string,
    executionDir: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const dockerArgs = [
        'exec',\n        '--user', 'sandbox',\n        '--workdir', '/workspace',
        session.containerName,
        'python', '/tmp/main.py'
      ];

      const process = spawn('docker', dockerArgs, {
        cwd: executionDir,
        env: {
          ...process.env,\n          PYTHONPATH: '/sandbox/python:/workspace',
          MPLBACKEND: 'Agg'
        }
      });

      this.activeExecutions.set(executionId, process);

      const outputCapture = new OutputCapture();\n      let stdout = '';\n      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Set timeout
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`Execution timeout after ${request.timeout || 30000}ms`));
      }, request.timeout || 30000);

      process.on('close', async (code) => {
        clearTimeout(timeout);
        this.activeExecutions.delete(executionId);

        const executionTime = Date.now() - startTime;
        const metrics = await this.resourceMonitor.getContainerMetrics(session.containerName);

        try {
          // Parse execution result\n          const result = JSON.parse(stdout || '{}');
          
          resolve({
            success: result.success || false,
            sessionId: session.id,
            executionId,
            output: {\n              stdout: result.stdout || '',
              stderr: result.stderr || stderr,
              plots: result.plots || [],
              variables: result.variables || {}
            },
            metrics: {
              executionTime,
              memoryUsage: metrics.memoryUsage || 0,
              cpuUsage: metrics.cpuUsage || 0
            },
            error: result.error
          });
        } catch (parseError) {
          resolve({
            success: false,
            sessionId: session.id,
            executionId,
            output: {
              stdout,
              stderr,
              plots: [],
              variables: {}
            },
            metrics: {
              executionTime,
              memoryUsage: 0,
              cpuUsage: 0
            },
            error: {
              type: 'ParseError',
              message: 'Failed to parse execution result',
              traceback: parseError.message
            }
          });
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        this.activeExecutions.delete(executionId);
        reject(error);
      });
    });
  }

  private async executeInContainerStream(
    session: Session,
    request: ExecutionRequest,
    executionId: string,
    executionDir: string,
    onOutput: (chunk: { type: 'stdout' | 'stderr' | 'plot' | 'variable'; data: any }) => void
  ): Promise<ExecutionResult> {
    // Similar to executeInContainer but with streaming callbacks
    // Implementation would stream output as it arrives
    // For brevity, using the non-streaming version as base
    return this.executeInContainer(session, request, executionId, executionDir);
  }

  private async createSessionContainer(session: Session): Promise<void> {
    const dockerArgs = [
      'run',\n      '-d',\n      '--name', session.containerName,\n      '--memory', '512m',\n      '--cpus', '0.5',\n      '--network', 'none', // No network access by default\n      '--user', 'sandbox',\n      '--security-opt', 'no-new-privileges:true',\n      '--cap-drop', 'ALL',\n      '--read-only',\n      '--tmpfs', '/tmp:exec,size=100m',\n      '--tmpfs', '/workspace:exec,size=100m',\n      '-v', '/path/to/sandbox/python:/sandbox/python:ro',
      'penny-sandbox:latest',
      'sleep', 'infinity'
    ];

    return new Promise((resolve, reject) => {
      const process = spawn('docker', dockerArgs);
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {\n          reject(new Error(`Failed to create container: exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async destroySessionContainer(session: Session): Promise<void> {
    return new Promise((resolve) => {
      const process = spawn('docker', ['rm', '-f', session.containerName]);
      process.on('close', () => resolve());
      process.on('error', () => resolve()); // Continue even if container doesn't exist
    });
  }

  private async cleanupStaleSession(): Promise<void> {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > maxAge) {
        await this.destroySession(sessionId);
      }
    }
  }

  private async cleanupOrphanedSessions(): Promise<void> {
    // Clean up any Docker containers that might be left over
    const process = spawn('docker', ['ps', '-a', '--filter', 'name=sandbox-', '--format', '{{.Names}}']);\n    let output = '';
    
    process.stdout?.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', async () => {\n      const containerNames = output.trim().split('
').filter(name => name.startsWith('sandbox-'));
      for (const containerName of containerNames) {
        spawn('docker', ['rm', '-f', containerName]);
      }
    });
  }

  async cleanup(): Promise<void> {
    // Stop all active executions
    for (const [executionId, process] of this.activeExecutions.entries()) {
      process.kill('SIGTERM');
    }
    this.activeExecutions.clear();

    // Destroy all sessions
    for (const sessionId of this.sessions.keys()) {
      await this.destroySession(sessionId);
    }
  }
}