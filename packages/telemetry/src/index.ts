// Placeholder for telemetry package
export const telemetry = {
  init: async () => {
    console.log('Telemetry initialized');
  },
  trace: (name: string, fn: () => Promise<any>) => {
    return fn();
  },
};