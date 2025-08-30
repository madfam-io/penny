import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const ValidateRequestSchema = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 50000 }),
  strict: Type.Optional(Type.Boolean()),
  includeWarnings: Type.Optional(Type.Boolean())
});

const ValidationIssueSchema = Type.Object({
  type: Type.Union([
    Type.Literal('error'),
    Type.Literal('warning'),
    Type.Literal('info')
  ]),
  severity: Type.Union([
    Type.Literal('critical'),
    Type.Literal('high'),
    Type.Literal('medium'),
    Type.Literal('low')
  ]),
  message: Type.String(),
  line: Type.Optional(Type.Number()),
  column: Type.Optional(Type.Number()),
  rule: Type.Optional(Type.String())
});

const ValidateResponseSchema = Type.Object({
  valid: Type.Boolean(),
  issues: Type.Array(ValidationIssueSchema),
  security: Type.Object({
    allowed: Type.Boolean(),
    riskLevel: Type.Union([
      Type.Literal('low'),
      Type.Literal('medium'),
      Type.Literal('high'),
      Type.Literal('critical')
    ]),
    violations: Type.Array(Type.String())
  }),
  analysis: Type.Object({
    complexity: Type.Number(),
    linesOfCode: Type.Number(),
    imports: Type.Array(Type.String()),
    functions: Type.Array(Type.String()),
    variables: Type.Array(Type.String()),
    hasHighRiskPatterns: Type.Boolean(),
    estimatedExecutionTime: Type.Number()
  }),
  suggestions: Type.Array(Type.Object({
    type: Type.Union([
      Type.Literal('performance'),
      Type.Literal('security'),
      Type.Literal('style'),
      Type.Literal('best-practice')
    ]),
    message: Type.String(),
    line: Type.Optional(Type.Number())
  }))
});

const validateRoute: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // Validate Python code\n  server.post('/', {
    schema: {
      body: ValidateRequestSchema,
      response: {
        200: ValidateResponseSchema,
        400: Type.Object({
          error: Type.String(),
          message: Type.String(),
          validationErrors: Type.Optional(Type.Array(Type.Any()))
        })
      }
    }
  }, async (request, reply) => {
    const { code, strict = false, includeWarnings = true } = request.body;

    try {
      // Security validation
      const securityCheck = await server.security.validateCode(code);

      // Static code analysis
      const analysisResult = await server.codeAnalyzer.analyze(code);

      // Syntax validation
      const syntaxIssues = await validatePythonSyntax(code);

      // Style and best practice checks
      const styleIssues = includeWarnings ? await checkCodeStyle(code) : [];

      // Combine all issues
      const allIssues = [
        ...syntaxIssues,
        ...securityCheck.violations.map(v => ({
          type: 'error' as const,
          severity: getSeverityFromViolation(v),
          message: v,
          rule: 'security'
        })),
        ...styleIssues
      ];

      // Filter by severity if strict mode
      const filteredIssues = strict 
        ? allIssues.filter(issue => issue.severity === 'critical' || issue.severity === 'high')
        : allIssues;

      // Generate suggestions
      const suggestions = generateSuggestions(code, analysisResult, securityCheck);

      const response = {
        valid: filteredIssues.length === 0 && securityCheck.allowed,
        issues: filteredIssues,
        security: {
          allowed: securityCheck.allowed,
          riskLevel: securityCheck.riskLevel,
          violations: securityCheck.violations
        },
        analysis: {
          complexity: analysisResult.complexity || 0,
          linesOfCode: analysisResult.linesOfCode || 0,
          imports: analysisResult.imports || [],
          functions: analysisResult.functions || [],
          variables: analysisResult.variables || [],
          hasHighRiskPatterns: analysisResult.hasHighRiskPatterns || false,
          estimatedExecutionTime: analysisResult.estimatedExecutionTime || 0
        },
        suggestions
      };

      return response;

    } catch (error) {
      server.log.error('Validation error:', error);
      
      return reply.status(400).send({
        error: 'Validation Error',
        message: error.message
      });
    }
  });

  // Validate specific aspects of code\n  server.post('/security', {
    schema: {
      body: Type.Object({
        code: Type.String({ minLength: 1, maxLength: 50000 })
      }),
      response: {
        200: Type.Object({
          allowed: Type.Boolean(),
          riskLevel: Type.Union([
            Type.Literal('low'),
            Type.Literal('medium'),
            Type.Literal('high'),
            Type.Literal('critical')
          ]),
          violations: Type.Array(Type.String()),
          details: Type.Object({
            blockedImports: Type.Array(Type.String()),
            dangerousPatterns: Type.Array(Type.String()),
            restrictedKeywords: Type.Array(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    const { code } = request.body;

    try {
      const securityCheck = await server.security.validateCode(code);
      
      // Additional detailed security analysis
      const details = {
        blockedImports: extractBlockedImports(code),
        dangerousPatterns: findDangerousPatterns(code),
        restrictedKeywords: findRestrictedKeywords(code)
      };

      return {
        allowed: securityCheck.allowed,
        riskLevel: securityCheck.riskLevel,
        violations: securityCheck.violations,
        details
      };

    } catch (error) {
      server.log.error('Security validation error:', error);
      
      return reply.status(400).send({
        error: 'Security Validation Error',
        message: error.message
      });
    }
  });

  // Validate syntax only\n  server.post('/syntax', {
    schema: {
      body: Type.Object({
        code: Type.String({ minLength: 1, maxLength: 50000 })
      }),
      response: {
        200: Type.Object({
          valid: Type.Boolean(),
          errors: Type.Array(Type.Object({
            message: Type.String(),
            line: Type.Number(),
            column: Type.Number(),
            type: Type.String()
          }))
        })
      }
    }
  }, async (request, reply) => {
    const { code } = request.body;

    try {
      const syntaxIssues = await validatePythonSyntax(code);
      const errors = syntaxIssues
        .filter(issue => issue.type === 'error')
        .map(issue => ({
          message: issue.message,
          line: issue.line || 0,
          column: issue.column || 0,
          type: 'SyntaxError'
        }));

      return {
        valid: errors.length === 0,
        errors
      };

    } catch (error) {
      server.log.error('Syntax validation error:', error);
      
      return reply.status(400).send({
        error: 'Syntax Validation Error',
        message: error.message
      });
    }
  });
};

// Helper functions
async function validatePythonSyntax(code: string): Promise<Array<{
  type: 'error' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
}>> {
  const issues: any[] = [];

  try {
    // Use Python's ast module to validate syntax
    const { spawn } = require('child_process');
    const python = spawn('python', ['-c', `
import ast
import sys

code = '''${code.replace(/'''/g, '"""')}'''

try:\n    ast.parse(code)
    print('{"valid": true}')
except SyntaxError as e:
    import json
    print(json.dumps({
        "valid": false,\n        "error": {
            "message": str(e),\n            "line": e.lineno,\n            "column": e.offset,\n            "type": "SyntaxError"
        }
    }))
except Exception as e:
    import json
    print(json.dumps({
        "valid": false,\n        "error": {
            "message": str(e),\n            "type": type(e).__name__
        }
    }))
`]);

    return new Promise((resolve) => {
      let output = '';
      python.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      python.on('close', () => {
        try {
          const result = JSON.parse(output.trim());
          if (!result.valid && result.error) {
            issues.push({
              type: 'error',
              severity: 'critical',
              message: result.error.message,
              line: result.error.line,
              column: result.error.column,
              rule: 'syntax'
            });
          }
        } catch (parseError) {
          // If we can't parse the output, assume syntax is valid
        }
        resolve(issues);
      });
    });

  } catch (error) {
    // Fallback: basic regex-based checks\n    const lines = code.split('
');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for common syntax issues\n      if (line.trim().endsWith(':') && !line.match(/^\s*(if|elif|else|for|while|def|class|try|except|finally|with)\b/)) {
        issues.push({
          type: 'warning',
          severity: 'medium',
          message: 'Potentially invalid colon usage',
          line: i + 1,
          rule: 'syntax'
        });
      }
    }
  }

  return issues;
}

async function checkCodeStyle(code: string): Promise<Array<{
  type: 'error' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
}>> {
  const issues: any[] = [];
  const lines = code.split('
');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check line length
    if (line.length > 120) {
      issues.push({
        type: 'warning',
        severity: 'low',
        message: 'Line too long (>120 characters)',
        line: i + 1,
        rule: 'line-length'
      });
    }

    // Check for tabs instead of spaces\n    if (line.includes('	')) {
      issues.push({
        type: 'warning',
        severity: 'low',
        message: 'Use spaces instead of tabs',
        line: i + 1,
        rule: 'indentation'
      });
    }

    // Check for trailing whitespace\n    if (line.endsWith(' ') || line.endsWith('	')) {
      issues.push({
        type: 'info',
        severity: 'low',
        message: 'Trailing whitespace',
        line: i + 1,
        rule: 'whitespace'
      });
    }
  }

  return issues;
}

function getSeverityFromViolation(violation: string): 'critical' | 'high' | 'medium' | 'low' {
  if (violation.includes('CRITICAL')) return 'critical';
  if (violation.includes('HIGH')) return 'high';
  if (violation.includes('MEDIUM')) return 'medium';
  return 'low';
}

function generateSuggestions(code: string, analysisResult: any, securityCheck: any) {
  const suggestions: any[] = [];

  // Performance suggestions
  if (code.includes('for ') && code.includes('append')) {
    suggestions.push({
      type: 'performance',
      message: 'Consider using list comprehension instead of append in loop'
    });
  }

  // Security suggestions
  if (!securityCheck.allowed) {
    suggestions.push({
      type: 'security',
      message: 'Remove blocked imports or dangerous patterns for security compliance'
    });
  }

  // Style suggestions
  if (analysisResult.complexity > 10) {
    suggestions.push({
      type: 'best-practice',
      message: 'Consider breaking down complex functions into smaller ones'
    });
  }

  return suggestions;
}

function extractBlockedImports(code: string): string[] {
  const blockedImports: string[] = [];
  const lines = code.split('
');
  
  for (const line of lines) {
    const importMatch = line.match(/^\s*(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/);
    if (importMatch) {
      // This would check against the actual blocked list from security policies
      blockedImports.push(importMatch[1]);
    }
  }
  
  return blockedImports;
}

function findDangerousPatterns(code: string): string[] {
  const patterns: string[] = [];
  
  if (code.includes('eval(') || code.includes('exec(')) {
    patterns.push('Dynamic code execution');
  }
 
 if (code.includes('__import__')) {
    patterns.push('Dynamic imports');
  }
  
  return patterns;
}

function findRestrictedKeywords(code: string): string[] {
  const keywords: string[] = [];
  const restrictedKeywords = ['eval', 'exec', 'compile', '__import__'];
  
  for (const keyword of restrictedKeywords) {
    if (code.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords;
}

export default validateRoute;