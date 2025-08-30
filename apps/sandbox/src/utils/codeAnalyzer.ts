import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface AnalysisResult {
  complexity: number;
  linesOfCode: number;
  imports: string[];
  functions: string[];
  variables: string[];
  classes: string[];
  hasHighRiskPatterns: boolean;
  risks: string[];
  estimatedExecutionTime: number;
  memoryEstimate: number;
  performance: {
    loops: number;
    recursion: boolean;
    dataStructures: string[];
    operations: string[];
  };
}

export class CodeAnalyzer {
  private pythonAnalyzerScript: string;

  constructor() {
    this.pythonAnalyzerScript = this.generateAnalyzerScript();
  }

  async analyze(code: string): Promise<AnalysisResult> {
    try {
      // Run static analysis using Python's AST
      const astAnalysis = await this.analyzeWithAST(code);
      
      // Perform regex-based analysis for additional patterns
      const patternAnalysis = this.analyzePatterns(code);
      
      // Estimate complexity and resource usage
      const complexityAnalysis = this.analyzeComplexity(code);
      
      // Combine results
      const result: AnalysisResult = {
        complexity: complexityAnalysis.complexity,
        linesOfCode: this.countLinesOfCode(code),
        imports: astAnalysis.imports || [],
        functions: astAnalysis.functions || [],
        variables: astAnalysis.variables || [],
        classes: astAnalysis.classes || [],
        hasHighRiskPatterns: patternAnalysis.hasHighRisk,
        risks: patternAnalysis.risks,
        estimatedExecutionTime: this.estimateExecutionTime(code, complexityAnalysis),
        memoryEstimate: this.estimateMemoryUsage(code),
        performance: {
          loops: complexityAnalysis.loopCount,
          recursion: complexityAnalysis.hasRecursion,
          dataStructures: this.detectDataStructures(code),
          operations: this.detectOperations(code)
        }
      };

      return result;

    } catch (error) {
      // Fallback to regex-based analysis if AST analysis fails
      return this.fallbackAnalysis(code);
    }
  }

  private async analyzeWithAST(code: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Create temporary file for analysis
      const tempFile = `/tmp/code_analysis_${Date.now()}.py`;
      \n      const analysisScript = `
import ast
import json
import sys
from collections import defaultdict
\ncode = '''${code.replace(/'''/g, '\"""')}'''

class CodeAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.imports = []
        self.functions = []
        self.variables = []
        self.classes = []
        self.complexity = 0
        self.loop_count = 0
        self.has_recursion = False
        self.function_calls = defaultdict(int)

    def visit_Import(self, node):
        for alias in node.names:
            self.imports.append(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            for alias in node.names:\n                self.imports.append(f"{node.module}.{alias.name}")
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        self.functions.append(node.name)
        self.complexity += 1
        
        # Check for recursion
        for child in ast.walk(node):
            if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
                if child.func.id == node.name:
                    self.has_recursion = True
        
        self.generic_visit(node)

    def visit_ClassDef(self, node):
        self.classes.append(node.name)
        self.complexity += 1
        self.generic_visit(node)

    def visit_Assign(self, node):
        for target in node.targets:
            if isinstance(target, ast.Name):
                self.variables.append(target.id)
        self.generic_visit(node)

    def visit_For(self, node):
        self.loop_count += 1
        self.complexity += 1
        self.generic_visit(node)

    def visit_While(self, node):
        self.loop_count += 1
        self.complexity += 1
        self.generic_visit(node)

    def visit_If(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_Try(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_Call(self, node):
        if isinstance(node.func, ast.Name):
            self.function_calls[node.func.id] += 1
        elif isinstance(node.func, ast.Attribute):
            self.function_calls[node.func.attr] += 1
        self.generic_visit(node)

try:
    tree = ast.parse(code)
    analyzer = CodeAnalyzer()
    analyzer.visit(tree)
    
    result = {
        'imports': list(set(analyzer.imports)),
        'functions': list(set(analyzer.functions)),
        'variables': list(set(analyzer.variables[:50])),  # Limit to first 50
        'classes': list(set(analyzer.classes)),
        'complexity': analyzer.complexity,
        'loop_count': analyzer.loop_count,
        'has_recursion': analyzer.has_recursion,
        'function_calls': dict(analyzer.function_calls)
    }
    
    print(json.dumps(result))

except SyntaxError as e:
    print(json.dumps({
        'error': 'SyntaxError',
        'message': str(e),
        'imports': [],
        'functions': [],
        'variables': [],
        'classes': [],
        'complexity': 0
    }))
except Exception as e:
    print(json.dumps({
        'error': type(e).__name__,
        'message': str(e),
        'imports': [],
        'functions': [],
        'variables': [],
        'classes': [],
        'complexity': 0
    }))
`;

      const process = spawn('python', ['-c', analysisScript]);\n      let output = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      process.on('error', reject);
    });
  }

  private analyzePatterns(code: string): { hasHighRisk: boolean; risks: string[] } {
    const risks: string[] = [];
    
    // High-risk patterns
    const highRiskPatterns = [
      { pattern: /eval\s*\(/g, message: 'Dynamic code evaluation (eval)' },
      { pattern: /exec\s*\(/g, message: 'Dynamic code execution (exec)' },
      { pattern: /__import__\s*\(/g, message: 'Dynamic imports' },
      { pattern: /compile\s*\(/g, message: 'Dynamic code compilation' },
      { pattern: /subprocess\./g, message: 'System command execution' },
      { pattern: /os\.system/g, message: 'System command execution' },
      { pattern: /os\.popen/g, message: 'System command execution' },
      { pattern: /ctypes\./g, message: 'Low-level system access' },
      { pattern: /socket\./g, message: 'Network access' },
      { pattern: /urllib\./g, message: 'Network access' },
      { pattern: /requests\./g, message: 'Network access' },
    ];

    // Medium-risk patterns
    const mediumRiskPatterns = [
      { pattern: /open\s*\(/g, message: 'File system access' },
      { pattern: /file\s*\(/g, message: 'File system access' },
      { pattern: /with\s+open/g, message: 'File system access' },
      { pattern: /pickle\./g, message: 'Object serialization/deserialization' },
      { pattern: /marshal\./g, message: 'Object serialization/deserialization' },
      { pattern: /threading\./g, message: 'Multi-threading' },
      { pattern: /multiprocessing\./g, message: 'Multi-processing' },
    ];

    // Check high-risk patterns
    for (const { pattern, message } of highRiskPatterns) {
      if (pattern.test(code)) {\n        risks.push(`HIGH RISK: ${message}`);
      }
    }

    // Check medium-risk patterns
    for (const { pattern, message } of mediumRiskPatterns) {
      if (pattern.test(code)) {\n        risks.push(`MEDIUM RISK: ${message}`);
      }
    }

    // Check for potential infinite loops
    if (code.includes('while True:') && !code.includes('break')) {
      risks.push('MEDIUM RISK: Potential infinite loop');
    }

    // Check for large data operations
    if (code.match(/range\s*\(\s*\d{6,}\s*\)/)) {
      risks.push('MEDIUM RISK: Large range operations');
    }

    return {
      hasHighRisk: risks.some(risk => risk.includes('HIGH RISK')),
      risks
    };
  }

  private analyzeComplexity(code: string): {
    complexity: number;
    loopCount: number;
    hasRecursion: boolean;
  } {
    let complexity = 1; // Base complexity
    let loopCount = 0;
    let hasRecursion = false;

    // Count control structures
    const controlStructures = [
      /\bif\b/g,
      /\belif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\btry\b/g,
      /\bexcept\b/g,
      /\bfinally\b/g,
      /\bwith\b/g
    ];

    for (const pattern of controlStructures) {
      const matches = code.match(pattern) || [];
      complexity += matches.length;
      
      if (pattern.source.includes('for') || pattern.source.includes('while')) {
        loopCount += matches.length;
      }
    }

    // Check for recursion (basic check)
    const functionMatches = code.match(/def\s+(\w+)/g);
    if (functionMatches) {
      for (const funcMatch of functionMatches) {
        const funcName = funcMatch.replace('def ', '').trim();\n        const funcPattern = new RegExp(`\b${funcName}\s*\(`, 'g');
        const callMatches = code.match(funcPattern) || [];
        if (callMatches.length > 1) { // Function definition + at least one call
          hasRecursion = true;
        }
      }
    }

    return { complexity, loopCount, hasRecursion };
  }

  private countLinesOfCode(code: string): number {\n    return code.split('
')\n      .filter(line => line.trim() !== '' && !line.trim().startsWith('#'))
      .length;
  }

  private estimateExecutionTime(code: string, complexityAnalysis: any): number {
    let baseTime = 100; // Base execution time in milliseconds

    // Add time based on complexity
    baseTime += complexityAnalysis.complexity * 10;
    
    // Add time for loops
    baseTime += complexityAnalysis.loopCount * 50;
    
    // Add time for recursion
    if (complexityAnalysis.hasRecursion) {
      baseTime += 200;
    }

    // Add time for heavy operations
    const heavyOperations = [
      { pattern: /matplotlib\./g, time: 500 },
      { pattern: /pandas\./g, time: 200 },
      { pattern: /numpy\./g, time: 100 },
      { pattern: /scipy\./g, time: 300 },
      { pattern: /sklearn\./g, time: 400 },
      { pattern: /\.plot\(/g, time: 300 },
      { pattern: /\.fit\(/g, time: 400 },
      { pattern: /\.transform\(/g, time: 200 }
    ];

    for (const { pattern, time } of heavyOperations) {
      const matches = code.match(pattern) || [];
      baseTime += matches.length * time;
    }

    return Math.min(baseTime, 30000); // Cap at 30 seconds
  }

  private estimateMemoryUsage(code: string): number {
    let baseMemory = 10; // Base memory in MB

    // Add memory for data structures
    const memoryPatterns = [
      { pattern: /\[\s*\]/g, memory: 1 }, // Empty lists
      { pattern: /\{\s*\}/g, memory: 1 }, // Empty dicts
      { pattern: /range\s*\(\s*(\d+)/g, memory: 0, calculate: true }, // Ranges
      { pattern: /numpy\.array/g, memory: 5 },
      { pattern: /pandas\.DataFrame/g, memory: 10 },
      { pattern: /\.read_csv/g, memory: 20 },
      { pattern: /\.read_excel/g, memory: 15 }
    ];

    for (const { pattern, memory, calculate } of memoryPatterns) {
      const matches = code.match(pattern) || [];
      if (calculate) {
        // Calculate memory for ranges
        for (const match of matches) {
          const sizeMatch = match.match(/\d+/);
          if (sizeMatch) {
            const size = parseInt(sizeMatch[0]);
            baseMemory += Math.min(size / 100000, 50); // Rough estimate
          }
        }
      } else {
        baseMemory += matches.length * memory;
      }
    }

    return Math.min(baseMemory, 512); // Cap at 512MB
  }

  private detectDataStructures(code: string): string[] {
    const structures: string[] = [];
    const patterns = [
      { pattern: /\[\]/g, name: 'list' },
      { pattern: /\{\}/g, name: 'dict' },
      { pattern: /set\(\)/g, name: 'set' },
      { pattern: /tuple\(\)/g, name: 'tuple' },
      { pattern: /collections\./g, name: 'collections' },
      { pattern: /numpy\.array/g, name: 'numpy.array' },
      { pattern: /pandas\.DataFrame/g, name: 'pandas.DataFrame' },
      { pattern: /pandas\.Series/g, name: 'pandas.Series' }
    ];

    for (const { pattern, name } of patterns) {
      if (pattern.test(code)) {
        structures.push(name);
      }
    }

    return [...new Set(structures)];
  }

  private detectOperations(code: string): string[] {
    const operations: string[] = [];
    const patterns = [
      { pattern: /\.sort\(/g, name: 'sorting' },
      { pattern: /\.join\(/g, name: 'joining' },
      { pattern: /\.split\(/g, name: 'splitting' },
      { pattern: /\.map\(/g, name: 'mapping' },
      { pattern: /\.filter\(/g, name: 'filtering' },
      { pattern: /\.reduce\(/g, name: 'reducing' },
      { pattern: /\.groupby\(/g, name: 'grouping' },
      { pattern: /\.merge\(/g, name: 'merging' },
      { pattern: /\.concat\(/g, name: 'concatenation' },
      { pattern: /\.plot\(/g, name: 'plotting' },
      { pattern: /\.fit\(/g, name: 'model_fitting' },
      { pattern: /\.predict\(/g, name: 'prediction' }
    ];

    for (const { pattern, name } of patterns) {
      if (pattern.test(code)) {
        operations.push(name);
      }
    }

    return [...new Set(operations)];
  }

  private fallbackAnalysis(code: string): AnalysisResult {
    return {\n      complexity: Math.min(code.split('
').length / 10, 20),
      linesOfCode: this.countLinesOfCode(code),
      imports: this.extractImportsRegex(code),
      functions: this.extractFunctionsRegex(code),
      variables: this.extractVariablesRegex(code),
      classes: this.extractClassesRegex(code),
      hasHighRiskPatterns: this.analyzePatterns(code).hasHighRisk,
      risks: this.analyzePatterns(code).risks,
      estimatedExecutionTime: 1000,
      memoryEstimate: 50,
      performance: {
        loops: (code.match(/\b(for|while)\b/g) || []).length,
        recursion: false,
        dataStructures: this.detectDataStructures(code),
        operations: this.detectOperations(code)
      }
    };
  }

  private extractImportsRegex(code: string): string[] {
    const imports: string[] = [];\n    const lines = code.split('
');
    
    for (const line of lines) {
      const importMatch = line.match(/^\s*(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/);
      if (importMatch) {
        imports.push(importMatch[1]);
      }
    }
    
    return [...new Set(imports)];
  }

  private extractFunctionsRegex(code: string): string[] {
    const functions: string[] = [];
    const matches = code.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
    
    for (const match of matches) {
      const funcName = match.replace('def ', '').trim();
      functions.push(funcName);
    }
    
    return [...new Set(functions)];
  }

  private extractVariablesRegex(code: string): string[] {
    const variables: string[] = [];\n    const lines = code.split('
');
    
    for (const line of lines) {
      const assignMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
      if (assignMatch) {
        variables.push(assignMatch[1]);
      }
    }
    
    return [...new Set(variables.slice(0, 50))]; // Limit to first 50
  }

  private extractClassesRegex(code: string): string[] {
    const classes: string[] = [];
    const matches = code.match(/class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
    
    for (const match of matches) {
      const className = match.replace('class ', '').replace(':', '').trim();
      classes.push(className);
    }
    
    return [...new Set(classes)];
  }

  private generateAnalyzerScript(): string {
    // This would be the Python script for AST analysis
    // For brevity, returning placeholder
    return 'ast_analyzer.py';
  }
}