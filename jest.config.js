/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/apps'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.base.json',
    }],
  },
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/.next/**',
    '!**/generated/**',
    '!**/migrations/**',
    '!**/seed.ts',
    '!**/vite.config.ts',
    '!**/next.config.js',
    '!**/tailwind.config.{js,ts}',
    '!**/postcss.config.js',
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 85,
      lines: 80,
      statements: 80,
    },
    // Higher standards for critical packages
    './packages/security/': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90,
    },
    './packages/database/': {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
  moduleNameMapper: {
    '^@penny/(.*)$': '<rootDir>/packages/$1/src',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  clearMocks: true,
  testTimeout: 10000,
  projects: [
    {
      displayName: 'core',
      testMatch: ['<rootDir>/packages/core/**/*.test.ts'],
    },
    {
      displayName: 'database',
      testMatch: ['<rootDir>/packages/database/**/*.test.ts'],
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/packages/security/**/*.test.ts'],
    },
    {
      displayName: 'shared',
      testMatch: ['<rootDir>/packages/shared/**/*.test.ts'],
    },
    {
      displayName: 'api',
      testMatch: ['<rootDir>/apps/api/**/*.test.ts'],
    },
    {
      displayName: 'web',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/apps/web/**/*.test.{ts,tsx}'],
    },
  ],
};