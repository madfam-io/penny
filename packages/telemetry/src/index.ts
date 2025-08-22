export * from './metrics/index.js';

// Re-export telemetry for backwards compatibility
export const telemetry = {
  init: async () => {
    console.log('Telemetry initialized');
  },
  trace: (name: string, fn: () => Promise<any>) => {
    return fn();
  },
};