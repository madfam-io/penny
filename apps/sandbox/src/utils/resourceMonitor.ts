import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface SystemHealth {
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  containers: {
    total: number;
    running: number;
    stopped: number;
  };
}

export interface ContainerMetrics {
  containerId: string;
  memoryUsage: number;
  memoryLimit: number;
  cpuUsage: number;
  networkIO: {
    rx: number;
    tx: number;
  };
  blockIO: {
    read: number;
    write: number;
  };
  pids: number;
}

export interface ResourceAlert {
  type: 'memory' | 'cpu' | 'disk' | 'container';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export class ResourceMonitor extends EventEmitter {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertThresholds = {
    memory: { warning: 80, critical: 90 },
    cpu: { warning: 70, critical: 85 },
    disk: { warning: 85, critical: 95 },
    containerMemory: { warning: 80, critical: 90 }
  };
  
  private lastCpuStats: any = null;
  private alertHistory = new Map<string, Date>();

  constructor() {
    super();
    this.startMonitoring();
  }

  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const [memoryInfo, cpuInfo, diskInfo, containerInfo] = await Promise.all([
        this.getMemoryInfo(),
        this.getCpuInfo(),
        this.getDiskInfo(),
        this.getContainerInfo()
      ]);

      const health: SystemHealth = {
        memory: memoryInfo,
        cpu: cpuInfo,
        disk: diskInfo,
        containers: containerInfo
      };

      // Check for alerts
      this.checkResourceAlerts(health);

      return health;

    } catch (error) {
      throw new Error(`Failed to get system health: ${error.message}`);
    }
  }

  async getContainerMetrics(containerName: string): Promise<ContainerMetrics | null> {
    try {
      return await this.getDockerStats(containerName);
    } catch (error) {
      console.error(`Failed to get container metrics for ${containerName}:`, error);
      return null;
    }
  }

  async getContainerResourceUsage(containerName: string): Promise<{
    memory: { usage: number; limit: number; percentage: number };
    cpu: { usage: number; percentage: number };
  }> {
    try {
      const metrics = await this.getContainerMetrics(containerName);
      
      if (!metrics) {
        return {
          memory: { usage: 0, limit: 0, percentage: 0 },
          cpu: { usage: 0, percentage: 0 }
        };
      }

      return {
        memory: {
          usage: metrics.memoryUsage,
          limit: metrics.memoryLimit,
          percentage: (metrics.memoryUsage / metrics.memoryLimit) * 100
        },
        cpu: {
          usage: metrics.cpuUsage,
          percentage: metrics.cpuUsage
        }
      };

    } catch (error) {
      return {
        memory: { usage: 0, limit: 0, percentage: 0 },
        cpu: { usage: 0, percentage: 0 }
      };
    }
  }

  private async getMemoryInfo(): Promise<{
    total: number;
    used: number;
    free: number;
    percentage: number;
  }> {
    return new Promise((resolve, reject) => {
      const process = spawn('free', ['-b']);
      let output = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const lines = output.trim().split('
');
            const memLine = lines[1].split(/\s+/);
            
            const total = parseInt(memLine[1]);
            const used = parseInt(memLine[2]);
            const free = parseInt(memLine[3]);
            const percentage = (used / total) * 100;

            resolve({ total, used, free, percentage });
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`free command failed with exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async getCpuInfo(): Promise<{
    usage: number;
    cores: number;
    loadAverage: number[];
  }> {
    const cores = require('os').cpus().length;
    const loadAvg = require('os').loadavg();

    // Get CPU usage
    const usage = await this.getCpuUsage();

    return {
      usage,
      cores,
      loadAverage: loadAvg
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve, reject) => {
      const process = spawn('cat', ['/proc/stat']);
      let output = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const lines = output.trim().split('
');
            const cpuLine = lines[0].split(/\s+/).slice(1).map(Number);
            
            const idle = cpuLine[3];
            const total = cpuLine.reduce((sum, val) => sum + val, 0);
            
            if (this.lastCpuStats) {
              const totalDiff = total - this.lastCpuStats.total;
              const idleDiff = idle - this.lastCpuStats.idle;
              const usage = ((totalDiff - idleDiff) / totalDiff) * 100;
              
              this.lastCpuStats = { total, idle };
              resolve(Math.max(0, Math.min(100, usage)));
            } else {
              this.lastCpuStats = { total, idle };
              resolve(0);
            }
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`CPU stats command failed with exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async getDiskInfo(): Promise<{
    total: number;
    used: number;
    free: number;
    percentage: number;
  }> {
    return new Promise((resolve, reject) => {
      const process = spawn('df', ['-B1', '/']);
      let output = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const lines = output.trim().split('
');
            const diskLine = lines[1].split(/\s+/);
            
            const total = parseInt(diskLine[1]);
            const used = parseInt(diskLine[2]);
            const free = parseInt(diskLine[3]);
            const percentage = (used / total) * 100;

            resolve({ total, used, free, percentage });
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`df command failed with exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async getContainerInfo(): Promise<{
    total: number;
    running: number;
    stopped: number;
  }> {
    return new Promise((resolve, reject) => {
      const process = spawn('docker', ['ps', '-a', '--format', '{{.Status}}']);
      let output = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const lines = output.trim().split('
').filter(line => line.trim() !== '');
            const total = lines.length;
            const running = lines.filter(line => line.startsWith('Up')).length;
            const stopped = total - running;

            resolve({ total, running, stopped });
          } catch (error) {
            resolve({ total: 0, running: 0, stopped: 0 });
          }
        } else {
          resolve({ total: 0, running: 0, stopped: 0 });
        }
      });

      process.on('error', () => resolve({ total: 0, running: 0, stopped: 0 }));
    });
  }

  private async getDockerStats(containerName: string): Promise<ContainerMetrics | null> {
    return new Promise((resolve, reject) => {
      const process = spawn('docker', ['stats', containerName, '--no-stream', '--format',
       '{{.Container}}	{{.MemUsage}}	{{.CPUPerc}}	{{.NetIO}}	{{.BlockIO}}	{{.PIDs}}']);
      let output = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.trim()) {
          try {
            const parts = output.trim().split('	');
            
            // Parse memory usage (e.g., "50MiB / 512MiB")
            const memoryParts = parts[1].split(' / ');
            const memoryUsage = this.parseMemorySize(memoryParts[0]);
            const memoryLimit = this.parseMemorySize(memoryParts[1]);

            // Parse CPU percentage (e.g., "15.23%")
            const cpuUsage = parseFloat(parts[2].replace('%', ''));
\n            // Parse network I/O (e.g., "1.2kB / 2.3kB")
            const netParts = parts[3].split(' / ');
            const networkRx = this.parseNetworkSize(netParts[0]);
            const networkTx = this.parseNetworkSize(netParts[1]);
\n            // Parse block I/O (e.g., "100MB / 200MB")
            const blockParts = parts[4].split(' / ');
            const blockRead = this.parseNetworkSize(blockParts[0]);
            const blockWrite = this.parseNetworkSize(blockParts[1]);

            // Parse PIDs
            const pids = parseInt(parts[5]) || 0;

            resolve({
              containerId: containerName,
              memoryUsage,
              memoryLimit,
              cpuUsage,
              networkIO: {
                rx: networkRx,
                tx: networkTx
              },
              blockIO: {
                read: blockRead,
                write: blockWrite
              },
              pids
            });
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(null);
        }
      });

      process.on('error', () => resolve(null));

      // Timeout after 10 seconds
      setTimeout(() => {
        process.kill();
        resolve(null);
      }, 10000);
    });
  }

  private parseMemorySize(sizeStr: string): number {
    const units = { 'B': 1, 'KiB': 1024, 'MiB': 1024**2, 'GiB': 1024**3 };
    const match = sizeStr.trim().match(/^([\d.]+)\s*(\w+)$/);
    
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2] as keyof typeof units;
      return value * (units[unit] || 1);
    }
    
    return 0;
  }

  private parseNetworkSize(sizeStr: string): number {
    const units = { 'B': 1, 'kB': 1000, 'MB': 1000**2, 'GB': 1000**3 };
    const match = sizeStr.trim().match(/^([\d.]+)\s*(\w+)$/);
    
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2] as keyof typeof units;
      return value * (units[unit] || 1);
    }
    
    return 0;
  }

  private checkResourceAlerts(health: SystemHealth): void {
    const now = new Date();

    // Check memory usage
    if (health.memory.percentage > this.alertThresholds.memory.critical) {
      this.emitAlert({
        type: 'memory',
        severity: 'critical',\n        message: `Critical memory usage: ${health.memory.percentage.toFixed(1)}%`,
        value: health.memory.percentage,
        threshold: this.alertThresholds.memory.critical,
        timestamp: now
      });
    } else if (health.memory.percentage > this.alertThresholds.memory.warning) {
      this.emitAlert({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${health.memory.percentage.toFixed(1)}%`,
        value: health.memory.percentage,
        threshold: this.alertThresholds.memory.warning,
        timestamp: now
      });
    }

    // Check CPU usage
    if (health.cpu.usage > this.alertThresholds.cpu.critical) {
      this.emitAlert({
        type: 'cpu',
        severity: 'critical',
        message: `Critical CPU usage: ${health.cpu.usage.toFixed(1)}%`,
        value: health.cpu.usage,
        threshold: this.alertThresholds.cpu.critical,
        timestamp: now
      });
    } else if (health.cpu.usage > this.alertThresholds.cpu.warning) {
      this.emitAlert({
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage: ${health.cpu.usage.toFixed(1)}%`,
        value: health.cpu.usage,
        threshold: this.alertThresholds.cpu.warning,
        timestamp: now
      });
    }

    // Check disk usage
    if (health.disk.percentage > this.alertThresholds.disk.critical) {
      this.emitAlert({
        type: 'disk',
        severity: 'critical',
        message: `Critical disk usage: ${health.disk.percentage.toFixed(1)}%`,
        value: health.disk.percentage,
        threshold: this.alertThresholds.disk.critical,
        timestamp: now
      });
    } else if (health.disk.percentage > this.alertThresholds.disk.warning) {
      this.emitAlert({
        type: 'disk',
        severity: 'warning',
        message: `High disk usage: ${health.disk.percentage.toFixed(1)}%`,
        value: health.disk.percentage,
        threshold: this.alertThresholds.disk.warning,
        timestamp: now
      });
    }
  }

  private emitAlert(alert: ResourceAlert): void {
    const alertKey = `${alert.type}-${alert.severity}`;
    const lastAlert = this.alertHistory.get(alertKey);
    
    // Throttle alerts - only emit if last alert was more than 5 minutes ago
    if (!lastAlert || now.getTime() - lastAlert.getTime() > 5 * 60 * 1000) {
      this.alertHistory.set(alertKey, alert.timestamp);
      this.emit('alert', alert);
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        this.emit('health', health);
      } catch (error) {
        this.emit('error', error);
      }
    }, 30000); // Monitor every 30 seconds
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  public setAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }

  public getAlertThresholds(): typeof this.alertThresholds {
    return { ...this.alertThresholds };
  }

  // Cleanup resources
  public destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.alertHistory.clear();
  }
}