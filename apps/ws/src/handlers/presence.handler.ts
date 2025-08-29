import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { 
  AuthenticatedSocket, 
  SocketEvent, 
  PresenceStatus, 
  PresenceUpdateData, 
  PresenceUpdateSchema 
} from '../types';
import { PresenceService } from '../services/PresenceService';

export class PresenceHandler {
  private io: SocketIOServer;
  private redis: Redis;
  private presenceService: PresenceService;

  // Presence tracking timers
  private awayTimers: Map<string, NodeJS.Timeout> = new Map();
  private offlineTimers: Map<string, NodeJS.Timeout> = new Map();

  // Configuration
  private readonly AWAY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly OFFLINE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor(io: SocketIOServer, redis: Redis) {
    this.io = io;
    this.redis = redis;
    this.presenceService = new PresenceService(redis);
  }

  public setupHandlers(): void {
    this.io.on(SocketEvent.CONNECT, (socket: AuthenticatedSocket) => {
      this.setupSocketHandlers(socket);
    });

    // Setup periodic presence cleanup
    setInterval(() => {
      this.cleanupStalePresence();
    }, 60000); // Every minute
  }

  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    if (!socket.user) return;

    // Manual presence updates
    socket.on(SocketEvent.PRESENCE_UPDATE, (data) => 
      this.handlePresenceUpdate(socket, data)
    );

    // Activity tracking
    socket.on('activity', () => this.handleUserActivity(socket));
    
    // Conversation-specific events that indicate activity
    socket.on(SocketEvent.SEND_MESSAGE, () => this.handleUserActivity(socket));
    socket.on(SocketEvent.TYPING_START, () => this.handleUserActivity(socket));
    socket.on(SocketEvent.JOIN_CONVERSATION, () => this.handleUserActivity(socket));

    // Disconnect handling
    socket.on(SocketEvent.DISCONNECT, () => this.handleDisconnect(socket));

    // Initial presence setup
    this.handleUserActivity(socket);
  }

  private async handlePresenceUpdate(
    socket: AuthenticatedSocket, 
    data: unknown
  ): Promise<void> {
    try {
      const presenceData = PresenceUpdateSchema.parse(data);
      const user = socket.user!;

      logger.debug({
        socketId: socket.id,
        userId: user.id,
        status: presenceData.status,
        customMessage: presenceData.customMessage
      }, 'Manual presence update');

      // Update presence in service
      await this.presenceService.updatePresence(user.id, {
        status: presenceData.status,
        lastActive: new Date(),
        customMessage: presenceData.customMessage,
        socketIds: new Set([socket.id])
      });

      // Clear existing timers for manual updates
      this.clearPresenceTimers(user.id);

      // Broadcast presence change to tenant
      this.io.to(`tenant:${user.tenantId}`).emit(SocketEvent.USER_PRESENCE_CHANGED, {
        userId: user.id,
        userName: user.name,
        status: presenceData.status,
        customMessage: presenceData.customMessage,
        lastActive: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });

      // Set up new timers if status is online
      if (presenceData.status === PresenceStatus.ONLINE) {
        this.setupPresenceTimers(user.id, user.tenantId, user.name);
      }

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error updating presence');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to update presence',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleUserActivity(socket: AuthenticatedSocket): Promise<void> {
    const user = socket.user;
    if (!user) return;

    try {
      // Get current presence
      const currentPresence = await this.presenceService.getPresence(user.id);
      
      // Only update if not manually set to away/busy or if currently away
      const shouldUpdate = !currentPresence || 
        currentPresence.status === PresenceStatus.OFFLINE ||
        currentPresence.status === PresenceStatus.AWAY ||
        currentPresence.status === PresenceStatus.ONLINE;

      if (shouldUpdate) {
        // Update to online status
        await this.presenceService.updatePresence(user.id, {
          status: PresenceStatus.ONLINE,
          lastActive: new Date(),
          socketIds: new Set([socket.id])
        });

        // Broadcast if status changed
        if (!currentPresence || currentPresence.status !== PresenceStatus.ONLINE) {
          this.io.to(`tenant:${user.tenantId}`).emit(SocketEvent.USER_PRESENCE_CHANGED, {
            userId: user.id,
            userName: user.name,
            status: PresenceStatus.ONLINE,
            lastActive: new Date().toISOString(),
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Just update last active time
        await this.presenceService.updateLastActive(user.id, new Date());
      }

      // Reset presence timers
      this.clearPresenceTimers(user.id);
      this.setupPresenceTimers(user.id, user.tenantId, user.name);

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: user.id,
        error: error.message
      }, 'Error handling user activity');
    }
  }

  private async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    const user = socket.user;
    if (!user) return;

    // Check if user has other active connections
    const userSockets = await this.getUserActiveSockets(user.id);
    
    if (userSockets.length === 0) {
      // No other active connections, start offline timer
      this.setupOfflineTimer(user.id, user.tenantId, user.name);
    }
  }

  private setupPresenceTimers(userId: string, tenantId: string, userName: string): void {
    // Clear existing timers
    this.clearPresenceTimers(userId);

    // Set away timer
    const awayTimer = setTimeout(async () => {
      try {
        const currentPresence = await this.presenceService.getPresence(userId);
        
        // Only set to away if currently online
        if (currentPresence?.status === PresenceStatus.ONLINE) {
          await this.presenceService.updatePresence(userId, {
            status: PresenceStatus.AWAY,
            lastActive: new Date(),
            socketIds: currentPresence.socketIds
          });

          this.io.to(`tenant:${tenantId}`).emit(SocketEvent.USER_PRESENCE_CHANGED, {
            userId,
            userName,
            status: PresenceStatus.AWAY,
            lastActive: new Date().toISOString(),
            timestamp: new Date().toISOString()
          });

          // Setup offline timer
          this.setupOfflineTimer(userId, tenantId, userName);
        }
      } catch (error) {
        logger.error({ userId, error: error.message }, 'Error in away timer');
      }
    }, this.AWAY_TIMEOUT);

    this.awayTimers.set(userId, awayTimer);
  }

  private setupOfflineTimer(userId: string, tenantId: string, userName: string): void {
    // Clear existing offline timer
    const existingTimer = this.offlineTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const offlineTimer = setTimeout(async () => {
      try {
        await this.presenceService.updatePresence(userId, {
          status: PresenceStatus.OFFLINE,
          lastActive: new Date(),
          socketIds: new Set()
        });

        this.io.to(`tenant:${tenantId}`).emit(SocketEvent.USER_PRESENCE_CHANGED, {
          userId,
          userName,
          status: PresenceStatus.OFFLINE,
          lastActive: new Date().toISOString(),
          timestamp: new Date().toISOString()
        });

        // Cleanup timers
        this.clearPresenceTimers(userId);
      } catch (error) {
        logger.error({ userId, error: error.message }, 'Error in offline timer');
      }
    }, this.OFFLINE_TIMEOUT);

    this.offlineTimers.set(userId, offlineTimer);
  }

  private clearPresenceTimers(userId: string): void {
    const awayTimer = this.awayTimers.get(userId);
    if (awayTimer) {
      clearTimeout(awayTimer);
      this.awayTimers.delete(userId);
    }

    const offlineTimer = this.offlineTimers.get(userId);
    if (offlineTimer) {
      clearTimeout(offlineTimer);
      this.offlineTimers.delete(userId);
    }
  }

  private async getUserActiveSockets(userId: string): Promise<string[]> {
    // Get all sockets for the user from Socket.IO
    const sockets = await this.io.fetchSockets();
    return sockets
      .filter(socket => (socket as any).user?.id === userId)
      .map(socket => socket.id);
  }

  private async cleanupStalePresence(): Promise<void> {
    try {
      // Get all active presences
      const allPresences = await this.presenceService.getAllPresences();
      
      for (const [userId, presence] of allPresences.entries()) {
        // Check if any sockets are still active for this user
        const activeSockets = await this.getUserActiveSockets(userId);
        
        if (activeSockets.length === 0 && presence.status !== PresenceStatus.OFFLINE) {
          // No active sockets but presence is not offline
          const timeSinceLastActive = Date.now() - presence.lastActive.getTime();
          
          if (timeSinceLastActive > this.OFFLINE_TIMEOUT) {
            logger.debug({ userId }, 'Cleaning up stale presence - marking offline');
            
            await this.presenceService.updatePresence(userId, {
              status: PresenceStatus.OFFLINE,
              lastActive: new Date(),
              socketIds: new Set()
            });

            // Cleanup any remaining timers
            this.clearPresenceTimers(userId);
          }
        }
      }
    } catch (error) {
      logger.error({ error: error.message }, 'Error cleaning up stale presence');
    }
  }

  // Public methods for external use
  public async getPresence(userId: string) {
    return await this.presenceService.getPresence(userId);
  }

  public async getUsersPresence(userIds: string[]) {
    return await this.presenceService.getBulkPresence(userIds);
  }

  public async getTenantPresence(tenantId: string) {
    // Get all active sockets for the tenant
    const sockets = await this.io.in(`tenant:${tenantId}`).fetchSockets();
    const userIds = [...new Set(sockets.map(socket => (socket as any).user?.id).filter(Boolean))];
    
    return await this.presenceService.getBulkPresence(userIds);
  }

  public async forceOffline(userId: string, tenantId: string, userName: string): Promise<void> {
    this.clearPresenceTimers(userId);
    
    await this.presenceService.updatePresence(userId, {
      status: PresenceStatus.OFFLINE,
      lastActive: new Date(),
      socketIds: new Set()
    });

    this.io.to(`tenant:${tenantId}`).emit(SocketEvent.USER_PRESENCE_CHANGED, {
      userId,
      userName,
      status: PresenceStatus.OFFLINE,
      lastActive: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
  }

  public getPresenceMetrics() {
    return {
      activeAwayTimers: this.awayTimers.size,
      activeOfflineTimers: this.offlineTimers.size,
      awayTimeout: this.AWAY_TIMEOUT,
      offlineTimeout: this.OFFLINE_TIMEOUT
    };
  }
}