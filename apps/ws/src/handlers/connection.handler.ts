import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { AuthenticatedSocket, SocketEvent, JoinRoomData, JoinRoomSchema, RoomType } from '../types';
import { RoomService } from '../services/RoomService';
import { PresenceService } from '../services/PresenceService';

export class ConnectionHandler {
  private io: SocketIOServer;
  private redis: Redis;
  private roomService: RoomService;
  private presenceService: PresenceService;

  // Connection tracking
  private activeConnections: Map<string, AuthenticatedSocket> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId

  constructor(io: SocketIOServer, redis: Redis) {
    this.io = io;
    this.redis = redis;
    this.roomService = new RoomService(redis);
    this.presenceService = new PresenceService(redis);
  }

  public setupHandlers(): void {
    this.io.on(SocketEvent.CONNECT, (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
      this.setupSocketEventHandlers(socket);
    });
  }

  private async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const user = socket.user;
      
      if (!user) {
        logger.warn({ socketId: socket.id }, 'Unauthenticated socket connection attempt');
        socket.emit(SocketEvent.AUTHENTICATION_ERROR, {
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        });
        socket.disconnect();
        return;
      }

      logger.info({
        socketId: socket.id,
        userId: user.id,
        tenantId: user.tenantId,
        userEmail: user.email
      }, 'Socket authenticated and connected');

      // Track connection
      this.activeConnections.set(socket.id, socket);
      this.socketUsers.set(socket.id, user.id);

      // Track user sockets
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(socket.id);

      // Initialize socket room tracking
      socket.rooms = new Set();
      socket.conversations = new Set();

      // Join user-specific room for direct messages
      const userRoomId = `user:${user.id}`;
      await socket.join(userRoomId);
      socket.rooms.add(userRoomId);

      // Join tenant-wide room for tenant-level broadcasts
      const tenantRoomId = `tenant:${user.tenantId}`;
      await socket.join(tenantRoomId);
      socket.rooms.add(tenantRoomId);

      // Update user presence to online
      await this.presenceService.updatePresence(user.id, {
        status: 'online',
        lastActive: new Date(),
        socketIds: this.userSockets.get(user.id) || new Set()
      });

      // Send successful connection confirmation
      socket.emit(SocketEvent.AUTHENTICATED, {
        socketId: socket.id,
        userId: user.id,
        tenantId: user.tenantId,
        connectedAt: new Date().toISOString(),
        features: [
          'real-time-chat',
          'presence-tracking',
          'typing-indicators',
          'message-reactions',
          'collaboration',
          'notifications'
        ]
      });

      // Broadcast user online status to tenant
      socket.to(tenantRoomId).emit(SocketEvent.USER_PRESENCE_CHANGED, {
        userId: user.id,
        userName: user.name,
        status: 'online',
        timestamp: new Date().toISOString()
      });

      // Setup heartbeat
      this.setupHeartbeat(socket);

      logger.debug({
        socketId: socket.id,
        userId: user.id,
        activeConnections: this.activeConnections.size
      }, 'Connection setup completed');

    } catch (error) {
      logger.error({
        socketId: socket.id,
        error: error.message
      }, 'Error handling connection');
      
      socket.emit(SocketEvent.ERROR, {
        message: 'Connection setup failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      socket.disconnect();
    }
  }

  private setupSocketEventHandlers(socket: AuthenticatedSocket): void {
    // Room management
    socket.on(SocketEvent.JOIN_ROOM, (data) => this.handleJoinRoom(socket, data));
    socket.on(SocketEvent.LEAVE_ROOM, (data) => this.handleLeaveRoom(socket, data));

    // Connection lifecycle
    socket.on(SocketEvent.DISCONNECT, (reason) => this.handleDisconnection(socket, reason));
    
    // Heartbeat
    socket.on(SocketEvent.HEARTBEAT, () => this.handleHeartbeat(socket));
    
    // Error handling
    socket.on('error', (error) => {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message
      }, 'Socket error');
    });
  }

  private async handleJoinRoom(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const roomData = JoinRoomSchema.parse(data);
      const user = socket.user!;

      logger.debug({
        socketId: socket.id,
        userId: user.id,
        roomId: roomData.roomId,
        roomType: roomData.roomType
      }, 'Joining room');

      // Validate room access permissions
      const canJoin = await this.validateRoomAccess(user, roomData);
      if (!canJoin) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Access denied to room',
          roomId: roomData.roomId,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Join the socket room
      await socket.join(roomData.roomId);
      socket.rooms?.add(roomData.roomId);

      // Update room membership in Redis
      await this.roomService.joinRoom(roomData.roomId, user.id, {
        type: roomData.roomType,
        tenantId: user.tenantId,
        metadata: roomData.metadata
      });

      // Notify other room participants
      socket.to(roomData.roomId).emit(SocketEvent.USER_JOINED, {
        roomId: roomData.roomId,
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString()
      });

      // Send confirmation to the user
      socket.emit(SocketEvent.ROOM_JOINED, {
        roomId: roomData.roomId,
        roomType: roomData.roomType,
        participants: await this.roomService.getRoomParticipants(roomData.roomId),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error joining room');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to join room',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleLeaveRoom(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { roomId } = data as { roomId: string };
      const user = socket.user!;

      logger.debug({
        socketId: socket.id,
        userId: user.id,
        roomId
      }, 'Leaving room');

      // Leave the socket room
      await socket.leave(roomId);
      socket.rooms?.delete(roomId);

      // Update room membership in Redis
      await this.roomService.leaveRoom(roomId, user.id);

      // Notify other room participants
      socket.to(roomId).emit(SocketEvent.USER_LEFT, {
        roomId,
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString()
      });

      // Send confirmation to the user
      socket.emit(SocketEvent.ROOM_LEFT, {
        roomId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error leaving room');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to leave room',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleDisconnection(socket: AuthenticatedSocket, reason: string): Promise<void> {
    const user = socket.user;
    
    if (!user) {
      return;
    }

    logger.info({
      socketId: socket.id,
      userId: user.id,
      reason,
      duration: Date.now() - (socket as any).connectedAt
    }, 'Socket disconnecting');

    try {
      // Remove from tracking
      this.activeConnections.delete(socket.id);
      this.socketUsers.delete(socket.id);

      // Update user socket tracking
      const userSockets = this.userSockets.get(user.id);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          // User has no more active sockets - mark as offline
          this.userSockets.delete(user.id);
          await this.presenceService.updatePresence(user.id, {
            status: 'offline',
            lastActive: new Date(),
            socketIds: new Set()
          });

          // Broadcast offline status
          this.io.to(`tenant:${user.tenantId}`).emit(SocketEvent.USER_PRESENCE_CHANGED, {
            userId: user.id,
            userName: user.name,
            status: 'offline',
            timestamp: new Date().toISOString()
          });
        } else {
          // Update presence with remaining sockets
          await this.presenceService.updatePresence(user.id, {
            status: 'online',
            lastActive: new Date(),
            socketIds: userSockets
          });
        }
      }

      // Leave all rooms
      if (socket.rooms) {
        for (const roomId of socket.rooms) {
          await this.roomService.leaveRoom(roomId, user.id);
          
          // Notify room participants
          socket.to(roomId).emit(SocketEvent.USER_LEFT, {
            roomId,
            userId: user.id,
            userName: user.name,
            reason,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Leave all conversations
      if (socket.conversations) {
        for (const conversationId of socket.conversations) {
          // Clear any typing indicators
          this.io.to(`conversation:${conversationId}`).emit(SocketEvent.TYPING_STOP, {
            conversationId,
            userId: user.id,
            userName: user.name,
            timestamp: new Date().toISOString()
          });
        }
      }

      logger.debug({
        userId: user.id,
        activeConnections: this.activeConnections.size,
        userRemainingConnections: userSockets?.size || 0
      }, 'Disconnection cleanup completed');

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: user?.id,
        error: error.message
      }, 'Error during disconnection cleanup');
    }
  }

  private handleHeartbeat(socket: AuthenticatedSocket): void {
    socket.emit(SocketEvent.PONG, {
      timestamp: new Date().toISOString()
    });
  }

  private setupHeartbeat(socket: AuthenticatedSocket): void {
    const heartbeatInterval = setInterval(() => {
      socket.emit(SocketEvent.HEARTBEAT);
    }, 25000); // 25 seconds

    socket.on(SocketEvent.DISCONNECT, () => {
      clearInterval(heartbeatInterval);
    });
  }

  private async validateRoomAccess(user: any, roomData: JoinRoomData): Promise<boolean> {
    // Implement room access validation logic based on room type
    switch (roomData.roomType) {
      case RoomType.CONVERSATION:
        // Check if user has access to the conversation
        // This would typically involve checking database permissions
        return true; // Simplified for now

      case RoomType.TENANT:
        // Check if user belongs to the tenant
        const tenantId = roomData.roomId.replace('tenant:', '');
        return user.tenantId === tenantId;

      case RoomType.USER:
        // Check if user is accessing their own room or has permission
        const userId = roomData.roomId.replace('user:', '');
        return user.id === userId;

      case RoomType.ADMIN:
        // Check if user has admin permissions
        return user.permissions?.includes('admin') || false;

      default:
        return false;
    }
  }

  // Public methods for external use
  public async broadcastToUser(userId: string, event: string, data: any): Promise<void> {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      for (const socketId of userSockets) {
        this.io.to(socketId).emit(event, data);
      }
    }
  }

  public async broadcastToTenant(tenantId: string, event: string, data: any): Promise<void> {
    this.io.to(`tenant:${tenantId}`).emit(event, data);
  }

  public async broadcastToRoom(roomId: string, event: string, data: any): Promise<void> {
    this.io.to(roomId).emit(event, data);
  }

  public getActiveConnections(): number {
    return this.activeConnections.size;
  }

  public getUserConnections(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  public getConnectionMetrics() {
    return {
      totalConnections: this.activeConnections.size,
      uniqueUsers: this.userSockets.size,
      averageSocketsPerUser: this.userSockets.size > 0 ? 
        this.activeConnections.size / this.userSockets.size : 0
    };
  }
}