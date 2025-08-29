import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SecurityCheck {
  allowed: boolean;
  reason?: string;
  violations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityPolicy {
  imports: {
    allowed: string[];
    blocked: string[];
    restricted: Record<string, string[]>; // module -> allowed functions
  };
  keywords: {
    blocked: string[];
    restricted: string[];
  };
  patterns: {
    dangerous: RegExp[];
    suspicious: RegExp[];
  };
  resources: {
    maxMemory: number;
    maxCpu: number;
    maxExecutionTime: number;
    maxFileSize: number;
    maxFiles: number;
  };
  filesystem: {
    allowedPaths: string[];
    blockedPaths: string[];
    readOnlyPaths: string[];
  };
}

export class SandboxSecurity {
  private policy: SecurityPolicy;

  constructor() {
    this.loadSecurityPolicies();
  }

  async validateCode(code: string): Promise<SecurityCheck> {
    const violations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Check for blocked imports
    const importViolations = this.checkImports(code);
    violations.push(...importViolations);

    // Check for dangerous keywords
    const keywordViolations = this.checkKeywords(code);
    violations.push(...keywordViolations);

    // Check for dangerous patterns
    const patternViolations = this.checkPatterns(code);
    violations.push(...patternViolations);

    // Check for code injection attempts
    const injectionViolations = this.checkCodeInjection(code);
    violations.push(...injectionViolations);

    // Determine risk level
    if (violations.some(v => v.includes('CRITICAL'))) {
      riskLevel = 'critical';
    } else if (violations.some(v => v.includes('HIGH'))) {
      riskLevel = 'high';
    } else if (violations.some(v => v.includes('MEDIUM'))) {
      riskLevel = 'medium';
    }

    return {
      allowed: violations.length === 0 || riskLevel !== 'critical',
      reason: violations.length > 0 ? violations[0] : undefined,
      violations,
      riskLevel
    };
  }

  private checkImports(code: string): string[] {
    const violations: string[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check import statements
      const importMatch = line.match(/^\s*(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)(?:\s+import\s+(.+))?/);
      if (importMatch) {
        const moduleName = importMatch[1];
        const importedItems = importMatch[2]?.split(',').map(item => item.trim());

        // Check if module is blocked
        if (this.policy.imports.blocked.includes(moduleName)) {
          violations.push(`CRITICAL: Blocked import '${moduleName}' at line ${i + 1}`);
          continue;
        }

        // Check if module has restrictions
        if (this.policy.imports.restricted[moduleName]) {
          const allowedFunctions = this.policy.imports.restricted[moduleName];
          if (importedItems) {
            for (const item of importedItems) {
              if (!allowedFunctions.includes(item.replace('as.*', '').trim())) {
                violations.push(`HIGH: Restricted function '${item}' from '${moduleName}' at line ${i + 1}`);
              }
            }
          }
        }

        // Check if module is in allowed list (if allowlist is used)
        if (this.policy.imports.allowed.length > 0 && 
            !this.policy.imports.allowed.includes(moduleName) &&
            !moduleName.startsWith('__')) {
          violations.push(`MEDIUM: Import '${moduleName}' not in allowlist at line ${i + 1}`);
        }
      }

      // Check for dynamic imports
      if (line.includes('__import__') || line.includes('importlib')) {
        violations.push(`CRITICAL: Dynamic import detected at line ${i + 1}`);
      }
    }

    return violations;
  }

  private checkKeywords(code: string): string[] {
    const violations: string[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for blocked keywords
      for (const keyword of this.policy.keywords.blocked) {
        if (line.includes(keyword)) {
          violations.push(`CRITICAL: Blocked keyword '${keyword}' at line ${i + 1}`);
        }
      }

      // Check for restricted keywords
      for (const keyword of this.policy.keywords.restricted) {
        if (line.includes(keyword)) {
          violations.push(`HIGH: Restricted keyword '${keyword}' at line ${i + 1}`);
        }
      }
    }

    return violations;
  }

  private checkPatterns(code: string): string[] {
    const violations: string[] = [];

    // Check dangerous patterns
    for (const pattern of this.policy.patterns.dangerous) {
      const matches = code.match(pattern);
      if (matches) {
        violations.push(`CRITICAL: Dangerous pattern detected: ${matches[0]}`);
      }
    }

    // Check suspicious patterns
    for (const pattern of this.policy.patterns.suspicious) {
      const matches = code.match(pattern);
      if (matches) {
        violations.push(`HIGH: Suspicious pattern detected: ${matches[0]}`);
      }
    }

    return violations;
  }

  private checkCodeInjection(code: string): string[] {
    const violations: string[] = [];

    // Check for eval/exec usage
    if (code.includes('eval(') || code.includes('exec(')) {
      violations.push('CRITICAL: Code execution functions detected (eval/exec)');
    }

    // Check for compile() usage
    if (code.includes('compile(')) {
      violations.push('CRITICAL: Dynamic code compilation detected');
    }

    // Check for subprocess/os.system usage
    if (code.match(/(?:subprocess|os\.system|os\.popen)/)) {
      violations.push('CRITICAL: System command execution detected');
    }

    // Check for file system access patterns
    if (code.match(/(?:open\s*\(|file\s*\(|with\s+open)/)) {
      violations.push('MEDIUM: File system access detected');
    }

    // Check for network access
    if (code.match(/(?:urllib|requests|http|socket|urllib3)/)) {
      violations.push('HIGH: Network access detected');
    }

    return violations;
  }

  validateFileSystem(filePath: string, operation: 'read' | 'write' | 'execute'): boolean {
    const normalizedPath = path.normalize(filePath);

    // Check blocked paths
    for (const blockedPath of this.policy.filesystem.blockedPaths) {
      if (normalizedPath.startsWith(blockedPath)) {
        return false;
      }
    }

    // Check allowed paths
    if (this.policy.filesystem.allowedPaths.length > 0) {
      const isAllowed = this.policy.filesystem.allowedPaths.some(allowedPath =>
        normalizedPath.startsWith(allowedPath)
      );
      if (!isAllowed) {
        return false;
      }
    }

    // Check read-only paths for write operations
    if (operation === 'write') {
      for (const readOnlyPath of this.policy.filesystem.readOnlyPaths) {
        if (normalizedPath.startsWith(readOnlyPath)) {
          return false;
        }
      }
    }

    return true;
  }

  getResourceLimits() {
    return this.policy.resources;
  }

  private async loadSecurityPolicies(): Promise<void> {
    try {
      const policiesDir = path.join(__dirname, 'policies');
      
      const [imports, resources, filesystem] = await Promise.all([
        fs.readFile(path.join(policiesDir, 'imports.json'), 'utf-8'),
        fs.readFile(path.join(policiesDir, 'resources.json'), 'utf-8'),
        fs.readFile(path.join(policiesDir, 'filesystem.json'), 'utf-8')
      ]);

      this.policy = {
        imports: JSON.parse(imports),
        keywords: {
          blocked: [
            '__import__',
            'importlib',
            'reload',
            'compile',
            'eval',
            'exec',
            'globals',
            'locals',
            'vars',
            'dir',
            'setattr',
            'getattr',
            'delattr',
            'hasattr'
          ],
          restricted: [
            'open',
            'file',
            'input',
            'raw_input',
            'print',
            'exit',
            'quit',
            'help'
          ]
        },
        patterns: {
          dangerous: [
            /(?:__|getattribute__|setattr__|delattr__)/g,
            /(?:subprocess|os\.system|os\.popen|commands)/g,
            /(?:socket|urllib|httplib|requests)/g,
            /(?:threading|multiprocessing)/g,
            /(?:ctypes|ctypes\.windll|ctypes\.cdll)/g,
            /(?:marshal|pickle|cPickle)\.loads/g
          ],
          suspicious: [
            /(?:base64|codecs|binascii)\.decode/g,
            /(?:zlib|gzip|bz2)\.decompress/g,
            /(?:\bexec\b|\beval\b)/g,
            /(?:__builtins__|__globals__|__locals__)/g
          ]
        },
        resources: JSON.parse(resources),
        filesystem: JSON.parse(filesystem)
      };

    } catch (error) {
      // Fallback to default policy if files don't exist
      this.policy = this.getDefaultPolicy();
    }
  }

  private getDefaultPolicy(): SecurityPolicy {
    return {
      imports: {
        allowed: [
          // Standard library - data processing
          'math', 'statistics', 'random', 'decimal', 'fractions',
          'datetime', 'time', 'calendar',
          'json', 're', 'string', 'textwrap',
          'collections', 'itertools', 'functools', 'operator',
          'copy', 'pprint',
          
          // Data science libraries
          'numpy', 'pandas', 'matplotlib', 'seaborn', 'plotly',
          'scipy', 'sklearn', 'scikit-learn',
          'PIL', 'cv2', 'imageio',
          
          // Jupyter/IPython
          'IPython', 'ipywidgets',
          
          // Other safe libraries
          'urllib.parse', 'base64', 'hashlib', 'uuid'
        ],
        blocked: [
          'os', 'sys', 'subprocess', 'shutil', 'glob', 'pathlib',
          'socket', 'urllib.request', 'urllib.error', 'http',
          'smtplib', 'poplib', 'imaplib', 'nntplib', 'ftplib',
          'threading', 'multiprocessing', 'asyncio',
          'ctypes', 'ctypes.util', 'ctypes.wintypes',
          'importlib', 'pkgutil', 'modulefinder',
          'ast', 'code', 'codeop', 'compile', 'dis',
          'gc', 'inspect', 'types', 'weakref'
        ],
        restricted: {
          'builtins': ['open', 'input', 'raw_input', 'compile', 'eval', 'exec'],
          'pickle': [], // Block all pickle functions
          'marshal': [], // Block all marshal functions
          'shelve': [] // Block all shelve functions
        }
      },
      keywords: {
        blocked: [
          '__import__', 'importlib', 'reload', 'compile', 'eval', 'exec'
        ],
        restricted: [
          'open', 'file', 'input', 'raw_input', 'exit', 'quit'
        ]
      },
      patterns: {
        dangerous: [
          /(?:__|getattribute__|setattr__|delattr__)/g,
          /(?:subprocess|os\.system|os\.popen)/g,
          /(?:socket|urllib|httplib|requests)/g,
          /(?:threading|multiprocessing)/g,
          /(?:ctypes)/g
        ],
        suspicious: [
          /(?:base64|codecs)\.decode/g,
          /(?:\bexec\b|\beval\b)/g,
          /(?:__builtins__|__globals__|__locals__)/g
        ]
      },
      resources: {
        maxMemory: 512 * 1024 * 1024, // 512MB
        maxCpu: 50, // 50% CPU
        maxExecutionTime: 30000, // 30 seconds
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 100
      },
      filesystem: {
        allowedPaths: ['/tmp', '/workspace'],
        blockedPaths: ['/etc', '/root', '/home', '/usr', '/var', '/sys', '/proc'],
        readOnlyPaths: ['/usr', '/lib', '/lib64']
      }
    };
  }
}