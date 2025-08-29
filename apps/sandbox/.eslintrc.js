module.exports = {
  extends: [
    '../../.eslintrc.js'
  ],
  parserOptions: {
    project: './tsconfig.json'
  },
  rules: {
    // Sandbox-specific rules
    '@typescript-eslint/no-explicit-any': 'warn', // Allow any for variable serialization
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    
    // Security-focused rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-child-process': 'warn',
    
    // Performance rules
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    
    // Code quality
    'complexity': ['warn', { max: 15 }],
    'max-lines': ['warn', { max: 500 }],
    'max-lines-per-function': ['warn', { max: 100 }],
    'max-params': ['warn', { max: 5 }],
    'max-depth': ['warn', { max: 4 }]
  },
  overrides: [
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        'security/detect-non-literal-fs-filename': 'off'
      }
    },
    {
      files: ['python/**/*.py'],
      parser: null,
      rules: {}
    }
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'python/',
    '*.js',
    '*.json'
  ]
};