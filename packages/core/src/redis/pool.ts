import Redis, { type RedisOptions } from 'ioredis';

export interface RedisPoolConfig {
  url?: string;
  maxConnections?: number;
  minConnections?: number;
  acquireTimeout?: number;
  idleTimeout?: number;
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number;
}

export class RedisConnectionPool {
  private connections: Redis[] = [];
  private availableConnections: Redis[] = [];
  private waitingQueue: Array<(conn: Redis) => void> = [];
  private config: Required<RedisPoolConfig>;
  private redisOptions: RedisOptions;
  private closed = false;

  constructor(config: RedisPoolConfig = {}) {
    this.config = {
      url: config.url || process.env.REDIS_URL || 'redis://localhost:6379',
      maxConnections: config.maxConnections || 10,
      minConnections: config.minConnections || 2,
      acquireTimeout: config.acquireTimeout || 30000,
      idleTimeout: config.idleTimeout || 30000,
      enableOfflineQueue: config.enableOfflineQueue ?? false,
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
    };

    // Parse Redis options from URL
    const url = new URL(this.config.url);
    this.redisOptions = {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || undefined,
      db: parseInt(url.pathname.slice(1) || '0'),
      enableOfflineQueue: this.config.enableOfflineQueue,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    };

    // Initialize minimum connections
    this.initializePool();
  }

  private async initializePool(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createConnection());
    }

    await Promise.all(promises);
  }

  private async createConnection(): Promise<void> {
    if (this.connections.length >= this.config.maxConnections) {
      throw new Error('Maximum connection limit reached');
    }

    const connection = new Redis(this.redisOptions);

    // Set up connection event handlers
    connection.on('error', (err) => {
      console.error('Redis connection error:', err);
      this.removeConnection(connection);
    });

    connection.on('close', () => {
      this.removeConnection(connection);
    });

    // Wait for connection to be ready
    await new Promise<void>((resolve, reject) => {
      connection.once('ready', () => {
        this.connections.push(connection);
        this.availableConnections.push(connection);
        resolve();
      });

      connection.once('error', reject);

      // Timeout for connection
      setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 10000);
    });
  }

  private removeConnection(connection: Redis): void {
    const index = this.connections.indexOf(connection);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }

    const availableIndex = this.availableConnections.indexOf(connection);
    if (availableIndex !== -1) {
      this.availableConnections.splice(availableIndex, 1);
    }

    // Clean up the connection
    connection.removeAllListeners();
    connection.disconnect();
  }

  async acquire(): Promise<Redis> {
    if (this.closed) {
      throw new Error('Pool is closed');
    }

    // If there's an available connection, use it
    if (this.availableConnections.length > 0) {
      return this.availableConnections.pop()!;
    }

    // If we can create more connections, do so
    if (this.connections.length < this.config.maxConnections) {
      await this.createConnection();
      return this.availableConnections.pop()!;
    }

    // Otherwise, wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.indexOf(resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);

      this.waitingQueue.push((conn: Redis) => {
        clearTimeout(timeout);
        resolve(conn);
      });
    });
  }

  release(connection: Redis): void {
    if (this.closed) {
      connection.disconnect();
      return;
    }

    // Check if connection is still healthy
    if (connection.status !== 'ready') {
      this.removeConnection(connection);

      // Try to maintain minimum connections
      if (this.connections.length < this.config.minConnections) {
        this.createConnection().catch(console.error);
      }
      return;
    }

    // If someone is waiting, give them the connection
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      waiter(connection);
      return;
    }

    // Otherwise, return it to the pool
    this.availableConnections.push(connection);

    // Set idle timeout
    setTimeout(() => {
      if (
        this.availableConnections.includes(connection) &&
        this.connections.length > this.config.minConnections
      ) {
        this.removeConnection(connection);
      }
    }, this.config.idleTimeout);
  }

  async withConnection<T>(fn: (conn: Redis) => Promise<T>): Promise<T> {
    const connection = await this.acquire();
    try {
      return await fn(connection);
    } finally {
      this.release(connection);
    }
  }

  async close(): Promise<void> {
    this.closed = true;

    // Reject all waiting requests
    for (const waiter of this.waitingQueue) {
      waiter(null as any);
    }
    this.waitingQueue = [];

    // Close all connections
    const promises = this.connections.map((conn) => {
      conn.removeAllListeners();
      return conn.quit();
    });

    await Promise.all(promises);

    this.connections = [];
    this.availableConnections = [];
  }

  getStats() {
    return {
      total: this.connections.length,
      available: this.availableConnections.length,
      inUse: this.connections.length - this.availableConnections.length,
      waiting: this.waitingQueue.length,
    };
  }
}

// Create a singleton pool
let redisPool: RedisConnectionPool | null = null;

export function getRedisPool(config?: RedisPoolConfig): RedisConnectionPool {
  if (!redisPool) {
    redisPool = new RedisConnectionPool(config);
  }
  return redisPool;
}

// Helper to get a pooled Redis connection
export async function getPooledRedis(): Promise<Redis> {
  const pool = getRedisPool();
  return pool.acquire();
}

// Helper to execute Redis commands with automatic connection management
export async function withRedis<T>(fn: (redis: Redis) => Promise<T>): Promise<T> {
  const pool = getRedisPool();
  return pool.withConnection(fn);
}
