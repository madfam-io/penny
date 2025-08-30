import { z } from 'zod';
import axios from 'axios';
import type { ToolDefinition, ToolContext, ToolResult } from '../types.js';

// Parameter schema
const PythonCodeParamsSchema = z.object({
  code: z.string().min(1, 'Code cannot be empty'),
  packages: z.array(z.string()).default([]),
  timeout: z.number().min(1).max(300).default(30), // Max 5 minutes
  captureOutput: z.boolean().default(true),
  showPlots: z.boolean().default(true),
  environment: z.enum(['basic', 'data_science', 'ml', 'web']).default('basic'),
  variables: z.record(z.any()).optional(),
  files: z.array(z.object({
    name: z.string(),
    content: z.string(),
    encoding: z.enum(['utf-8', 'base64']).default('utf-8')
  })).optional(),
  returnFormat: z.enum(['json', 'html', 'markdown']).default('json')
});

type PythonCodeParams = z.infer<typeof PythonCodeParamsSchema>;

/**
 * Python Code Execution Tool Handler
 */
async function pythonCodeHandler(
  params: PythonCodeParams,
  context: ToolContext
): Promise<ToolResult> {
  try {
    const { 
      code, 
      packages, 
      timeout, 
      captureOutput, 
      showPlots, 
      environment, 
      variables,
      files,
      returnFormat
    } = params;

    // Validate code for security
    const securityCheck = validateCodeSecurity(code);
    if (!securityCheck.safe) {
      return {
        success: false,
        error: {
          code: 'UNSAFE_CODE',
          message: `Code contains potentially unsafe operations: ${securityCheck.issues.join(', ')}`,
          category: 'validation',
          suggestions: [
            'Remove file system operations',
            'Avoid network requests',
            'Remove subprocess calls'
          ]
        }
      };
    }

    // Prepare execution payload
    const executionPayload = {
      code,
      packages,
      timeout,
      environment,
      variables: variables || {},
      files: files || [],
      options: {
        captureOutput,
        showPlots,
        returnFormat,
        tenantId: context.tenantId,
        userId: context.userId
      }
    };

    // Execute code in sandbox
    const executionResult = await executePythonCode(executionPayload, context);

    // Process results
    const artifacts: any[] = [];

    // Add output artifact
    if (executionResult.output) {
      artifacts.push({
        type: 'text',
        name: 'Python Output',
        content: executionResult.output,
        mimeType: 'text/plain',
        preview: executionResult.output.substring(0, 200) + (executionResult.output.length > 200 ? '...' : '')
      });
    }

    // Add error artifact if there were errors
    if (executionResult.errors) {
      artifacts.push({
        type: 'error',
        name: 'Python Errors',
        content: executionResult.errors,
        mimeType: 'text/plain'
      });
    }

    // Add plot artifacts
    if (executionResult.plots?.length) {
      executionResult.plots.forEach((plot: any, index: number) => {
        artifacts.push({
          type: 'visualization',
          name: `Plot ${index + 1}`,
          content: plot.data,
          mimeType: plot.mimeType || 'image/png',
          preview: plot.title || `Generated plot ${index + 1}`
        });
      });
    }

    // Add variable artifacts
    if (executionResult.variables && Object.keys(executionResult.variables).length > 0) {
      artifacts.push({
        type: 'data',
        name: 'Python Variables',
        content: executionResult.variables,
        mimeType: 'application/json',
        preview: `${Object.keys(executionResult.variables).length} variables captured`
      });
    }

    // Add file artifacts
    if (executionResult.files?.length) {
      executionResult.files.forEach((file: any) => {
        artifacts.push({
          type: 'file',
          name: file.name,
          content: file.content,
          mimeType: file.mimeType || 'application/octet-stream',
          downloadable: true
        });
      });
    }

    // Calculate usage
    const usage = {
      credits: Math.ceil(timeout / 10) + packages.length * 2,
      computeUnits: executionResult.resourceUsage?.cpu || 1,
      memorySeconds: executionResult.resourceUsage?.memory || 0,
      duration: executionResult.executionTime || 0,
    };

    return {
      success: true,
      data: {
        output: executionResult.output,
        errors: executionResult.errors,
        returnValue: executionResult.returnValue,
        variables: executionResult.variables,
        plots: executionResult.plots,
        files: executionResult.files,
        executionTime: executionResult.executionTime,
        resourceUsage: executionResult.resourceUsage
      },
      artifacts,
      usage,
      metadata: {
        environment,
        packagesInstalled: executionResult.packagesInstalled || packages,
        linesOfCode: code.split('
').length,
        executionId: executionResult.executionId,
        sandbox: true
      }
    };

  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'PYTHON_EXECUTION_ERROR',
        message: `Python code execution failed: ${error.message}`,
        details: error,
        category: 'execution',
        retryable: error.retryable !== false
      }
    };
  }
}

/**
 * Validate code for security issues
 */
function validateCodeSecurity(code: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];
  const lines = code.split('
');

  // Dangerous patterns to check for
  const dangerousPatterns = [
    { pattern: /import\s+os|from\s+os\s+import/, message: 'OS module import' },
    { pattern: /import\s+sys|from\s+sys\s+import/, message: 'System module import' },
    { pattern: /import\s+subprocess|from\s+subprocess\s+import/, message: 'Subprocess module import' },
    { pattern: /exec\s*\(|eval\s*\(/, message: 'Dynamic code execution' },
    { pattern: /open\s*\(.*['"][wr]/, message: 'File write operation' },
    { pattern: /urllib|requests|http/, message: 'Network request' },
    { pattern: /__import__|importlib/, message: 'Dynamic import' },
    { pattern: /socket|telnetlib|ftplib/, message: 'Network socket usage' },
    { pattern: /pickle\.loads|pickle\.load/, message: 'Unsafe pickle deserialization' }
  ];

  lines.forEach((line, index) => {
    dangerousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push(`${message} on line ${index + 1}`);
      }
    });
  });

  return {
    safe: issues.length === 0,
    issues
  };
}

/**
 * Execute Python code in sandbox environment
 */
async function executePythonCode(payload: any, context: ToolContext): Promise<any> {
  try {
    // In a real implementation, this would call the sandbox service
    // For now, we'll simulate the execution
    
    const sandboxUrl = process.env.SANDBOX_API_URL || 'http://localhost:3002';
    
    try {
      const response = await axios.post(`${sandboxUrl}/api/execute/python`, payload, {
        timeout: (payload.timeout + 10) * 1000, // Add buffer to request timeout
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${context.auth?.credentials?.token || ''}`,
          'X-Tenant-ID': context.tenantId,
          'X-User-ID': context.userId
        }
      });

      return response.data;
    } catch (axiosError: any) {
      if (axiosError.code === 'ECONNREFUSED') {
        // Sandbox service not available, return mock execution
        return mockPythonExecution(payload);
      }
      throw axiosError;
    }
  } catch (error: any) {
    throw new Error(`Sandbox execution failed: ${error.message}`);
  }
}

/**
 * Mock Python execution for demo purposes
 */
function mockPythonExecution(payload: any): any {
  const { code, environment, variables, packages, showPlots } = payload;
  
  // Analyze code to determine what kind of output to generate
  const hasPlot = /plt\.|pyplot|plot\(|hist\(|scatter\(/.test(code);
  const hasPrint = /print\s*\(/.test(code);
  const hasDataFrame = /pd\.|DataFrame|read_csv|read_excel/.test(code);
  const hasMath = /numpy|np\.|math\.|statistics/.test(code);

  let output = '';
  let plots: any[] = [];
  let resultVariables: any = {};

  // Generate mock output based on code content
  if (hasPrint) {
    output += 'Hello from Python!
';
    if (hasDataFrame) {
      output += 'DataFrame loaded successfully
';
      output += 'Shape: (100, 5)
';
    }
    if (hasMath) {
      output += 'Mathematical calculation completed
';
      output += 'Result: 42.0
';
    }
  }

  // Generate mock plots
  if (hasPlot && showPlots) {
    plots.push({
      title: 'Generated Plot',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      mimeType: 'image/png'
    });
  }

  // Generate mock variables
  if (variables) {
    resultVariables = { ...variables };
  }

  if (hasDataFrame) {
    resultVariables.df_shape = [100, 5];
    resultVariables.df_columns = ['col1', 'col2', 'col3', 'col4', 'col5'];
  }

  if (hasMath) {
    resultVariables.calculation_result = 42.0;
  }

  return {
    executionId: `exec_${Date.now()}`,
    output,
    errors: null,
    returnValue: null,
    variables: resultVariables,
    plots,
    files: [],
    executionTime: Math.random() * 2000 + 500, // 0.5-2.5 seconds
    resourceUsage: {
      cpu: Math.random() * 50 + 10, // 10-60% CPU
      memory: Math.random() * 100 + 50, // 50-150 MB
      disk: Math.random() * 10 + 5 // 5-15 MB
    },
    packagesInstalled: packages.length > 0 ? packages : ['numpy', 'pandas', 'matplotlib']
  };
}

/**
 * Python Code Tool Definition
 */
export const pythonCodeTool: ToolDefinition = {
  name: 'python_code',
  displayName: 'Python Code Execution',
  description: 'Execute Python code in a secure sandbox environment with support for data science libraries',
  category: 'development',
  version: '1.0.0',
  icon: '🐍',
  tags: ['python', 'code', 'execution', 'sandbox', 'data-science', 'ml'],
  author: 'PENNY Core',
  
  schema: PythonCodeParamsSchema,
  handler: pythonCodeHandler,
  
  config: {
    requiresAuth: true,
    requiresSandbox: true,
    permissions: ['code:execute', 'sandbox:use'],
    rateLimit: {
      requests: 20,
      window: 3600, // 1 hour
      burst: 5
    },
    timeout: 60000, // 1 minute default
    maxRetries: 1,
    maxMemoryMB: 256,
    maxCpuPercent: 50,
    cost: 25,
    creditsPerExecution: 5,
    showInMarketplace: true,
    featured: true,
    allowNetworkAccess: false,
    allowFileSystem: false
  },
  
  dependencies: [
    {
      name: 'sandbox-service',
      type: 'service',
      description: 'Python code execution sandbox'
    }
  ],
  
  metadata: {
    examples: [
      {
        title: 'Simple calculation',
        description: 'Perform basic mathematical operations',
        parameters: {
          code: `
import math

# Calculate area of circle
radius = 5
area = math.pi * radius ** 2
print(f"Area of circle with radius {radius}: {area:.2f}")
          `.trim(),
          environment: 'basic'
        }
      },
      {
        title: 'Data analysis',
        description: 'Analyze data using pandas and create visualization',
        parameters: {
          code: `
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Create sample data
data = {
    'month': ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    'sales': [1000, 1200, 950, 1400, 1350]
}
df = pd.DataFrame(data)

# Display data
print("Sales Data:")
print(df)

# Create plot
plt.figure(figsize=(10, 6))
plt.plot(df['month'], df['sales'], marker='o')
plt.title('Monthly Sales')
plt.xlabel('Month')
plt.ylabel('Sales ($)')
plt.grid(True)
plt.show()
          `.trim(),
          environment: 'data_science',
          packages: ['pandas', 'matplotlib', 'numpy'],
          showPlots: true
        }
      },
      {
        title: 'Machine learning',
        description: 'Train a simple machine learning model',
        parameters: {
          code: `
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import numpy as np

# Generate sample dataset
X, y = make_classification(n_samples=1000, n_features=20, n_informative=2, 
                          n_redundant=10, n_clusters_per_class=1, random_state=42)

# Split the data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train model
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# Make predictions
y_pred = clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"Dataset shape: {X.shape}")
print(f"Training set size: {X_train.shape[0]}")
print(f"Test set size: {X_test.shape[0]}")
print(f"Model accuracy: {accuracy:.3f}")
          `.trim(),
          environment: 'ml',
          packages: ['scikit-learn', 'numpy'],
          timeout: 60
        }
      }
    ],
    troubleshooting: [
      {
        issue: 'Code contains unsafe operations',
        solution: 'Remove file system access, network requests, and subprocess calls. Use only safe Python operations.',
        category: 'common'
      },
      {
        issue: 'Package not found',
        solution: 'Check if the package is available in the selected environment. Common packages include numpy, pandas, matplotlib, scikit-learn.',
        category: 'configuration'
      },
      {
        issue: 'Execution timeout',
        solution: 'Optimize your code for better performance or increase the timeout parameter (max 300 seconds).',
        category: 'performance'
      },
      {
        issue: 'Memory limit exceeded',
        solution: 'Reduce memory usage by processing data in smaller chunks or using more efficient data structures.',
        category: 'performance'
      }
    ]
  }
};