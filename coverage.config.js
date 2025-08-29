module.exports = {
  // Coverage collection settings
  collectCoverage: true,
  collectCoverageFrom: [
    // Include source files
    'apps/*/src/**/*.{ts,tsx}',
    'packages/*/src/**/*.{ts,tsx}',
    
    // Exclude test files and build artifacts
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/build/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/.next/**',
    '!**/cypress/**',
    
    // Exclude specific files
    '!apps/*/src/**/*.stories.{ts,tsx}',
    '!apps/*/src/**/*.config.{ts,js}',
    '!apps/*/src/**/*.mock.{ts,tsx}',
    '!apps/*/src/types/**/*',
    '!packages/*/src/types/**/*',
    
    // Exclude generated files
    '!**/__generated__/**',
    '!**/prisma/generated/**',
    '!**/api-docs/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 85,
      lines: 80,
      statements: 80,
    },
    
    // Per-application thresholds
    'apps/api/src/**/*.ts': {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    },
    
    'apps/web/src/**/*.{ts,tsx}': {
      branches: 70,
      functions: 80,
      lines: 75,
      statements: 75,
    },
    
    'apps/admin/src/**/*.{ts,tsx}': {
      branches: 70,
      functions: 80,
      lines: 75,
      statements: 75,
    },
    
    'apps/ws/src/**/*.ts': {
      branches: 75,
      functions: 85,
      lines: 80,
      statements: 80,
    },
    
    'apps/sandbox/src/**/*.ts': {
      branches: 85,  // Security critical - higher threshold
      functions: 90,
      lines: 90,
      statements: 90,
    },
    
    'apps/worker/src/**/*.ts': {
      branches: 75,
      functions: 85,
      lines: 80,
      statements: 80,
    },
    
    // Package-specific thresholds
    'packages/database/src/**/*.ts': {
      branches: 85,  // Data integrity critical
      functions: 90,
      lines: 90,
      statements: 90,
    },
    
    'packages/security/src/**/*.ts': {
      branches: 90,  // Security critical
      functions: 95,
      lines: 95,
      statements: 95,
    },
    
    'packages/auth/src/**/*.ts': {
      branches: 85,  // Authentication critical
      functions: 90,
      lines: 90,
      statements: 90,
    },
    
    'packages/tools/src/**/*.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    
    'packages/utils/src/**/*.ts': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    
    'packages/ui/src/**/*.{ts,tsx}': {
      branches: 65,  // UI components - more complex testing
      functions: 75,
      lines: 70,
      statements: 70,
    },
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
    'cobertura',
    'clover',
  ],

  // Coverage directory structure
  coverageDirectory: 'coverage',
  
  // Specific coverage paths
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/',
    '/coverage/',
    '/.next/',
    '/cypress/',
    '\\.d\\.ts$',
    '\\.config\\.(js|ts)$',
    '\\.stories\\.(ts|tsx)$',
    '\\.mock\\.(ts|tsx)$',
  ],

  // Custom coverage provider settings
  coverageProvider: 'v8', // Use V8 coverage (faster than babel)
  
  // Additional settings for better coverage accuracy
  collectCoverageOnlyFrom: {
    // Only collect coverage from source files, not tests
    'apps/*/src/**/*.{ts,tsx}': true,
    'packages/*/src/**/*.{ts,tsx}': true,
  },
  
  // Istanbul configuration for more detailed reports
  coverageReporterOptions: {
    html: {
      subdir: 'html',
      skipCovered: false,
      skipEmpty: false,
    },
    lcov: {
      subdir: 'lcov',
      file: 'lcov.info',
    },
    json: {
      subdir: 'json',
      file: 'coverage.json',
    },
    'json-summary': {
      subdir: 'json',
      file: 'coverage-summary.json',
    },
    text: {
      maxCols: 120,
    },
    cobertura: {
      subdir: 'cobertura',
      file: 'cobertura-coverage.xml',
    },
  },
};