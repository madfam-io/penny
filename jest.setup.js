// Jest setup file for global test configuration
require('dotenv').config({ path: '.env.test' });

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/penny_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret';

// Global test utilities
global.testUtils = {
  generateId: () => Math.random().toString(36).substring(7),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  mockDate: new Date('2024-01-01T00:00:00Z'),
};

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Restore console for debugging when needed
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global timeout for async operations
jest.setTimeout(10000);