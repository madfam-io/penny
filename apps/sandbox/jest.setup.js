import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.SANDBOX_PORT = '0'; // Use random port for tests
process.env.MAX_EXECUTION_TIME = '5000'; // Shorter timeout for tests
process.env.ENABLE_NETWORKING = 'false';
process.env.ENABLE_METRICS = 'false';

// Mock Docker commands for testing
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdout: {
      on: jest.fn()
    },
    stderr: {
      on: jest.fn()
    },
    kill: jest.fn()
  }))
}));

// Mock file system operations
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
  readFile: jest.fn(() => Promise.resolve('')),
  unlink: jest.fn(() => Promise.resolve()),
  readdir: jest.fn(() => Promise.resolve([])),
  stat: jest.fn(() => Promise.resolve({
    isFile: () => true,
    isDirectory: () => false,
    size: 1024,
    mtime: new Date()
  }))
}));

// Global test timeout
jest.setTimeout(30000);

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});