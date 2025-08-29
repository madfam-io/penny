import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { Room, RoomType, User } from '../types';

interface RoomParticipant {
  userId: string;
  userName: string;
  joinedAt: Date;
  lastActivity: Date;
  permissions?: string[];
}

interface RoomMetadata {
  type: RoomType;
  tenantId?: string;
  title?: string;
  description?: string;
  isPrivate?: boolean;
  maxParticipants?: number;
  permissions?: Record<string, string[]>; // role -> permissions
  settings?: Record<string, any>;
  tags?: string[];
}

export class RoomService {
  private redis: Redis;
  private readonly TTL = 24 * 60 * 60; // 24 hours default TTL

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // Room lifecycle management
  async createRoom(
    roomId: string, 
    creatorId: string, 
    metadata: RoomMetadata
  ): Promise<Room> {
    try {
      const room: Room = {
        id: roomId,
        type: metadata.type,
        tenantId: metadata.tenantId,
        metadata: metadata as Record<string, unknown>,
        participants: new Set(),
        createdAt: new Date(),
        lastActivity: new Date()
      };

      // Store room data
      const roomKey = `room:${roomId}`;
      await this.redis.hmset(roomKey, {
        id: roomId,
        type: metadata.type,
        tenantId: metadata.tenantId || '',
        metadata: JSON.stringify(metadata),
        createdAt: room.createdAt.toISOString(),
        lastActivity: room.lastActivity.toISOString(),
        creatorId
      });

      // Set TTL
      await this.redis.expire(roomKey, this.TTL);

      // Add creator as first participant
      if (creatorId) {
        await this.joinRoom(roomId, creatorId, { isCreator: true });
      }

      // Index room by type and tenant
      await this.indexRoom(roomId, metadata);

      logger.info({
        roomId,
        creatorId,
        roomType: metadata.type,
        tenantId: metadata.tenantId
      }, 'Room created');

      return room;

    } catch (error) {
      logger.error({
        roomId,
        creatorId,
        error: error.message
      }, 'Failed to create room');
      throw error;
    }
  }

  async joinRoom(
    roomId: string, 
    userId: string, 
    options: { 
      isCreator?: boolean;
      permissions?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    try {
      const roomKey = `room:${roomId}`;
      const participantsKey = `room:${roomId}:participants`;
      const userKey = `user:${userId}:rooms`;

      // Check if room exists
      const roomExists = await this.redis.exists(roomKey);
      if (!roomExists) {
        throw new Error('Room not found');
      }

      // Get room data to check constraints
      const roomData = await this.redis.hmget(roomKey, 'metadata', 'type', 'tenantId');
      const metadata = roomData[0] ? JSON.parse(roomData[0]) : {};
      const roomType = roomData[1];
      const tenantId = roomData[2];

      // Check room capacity
      if (metadata.maxParticipants) {
        const participantCount = await this.redis.scard(participantsKey);
        if (participantCount >= metadata.maxParticipants) {
          throw new Error('Room is at maximum capacity');
        }
      }

      // Create participant record
      const participant: RoomParticipant = {
        userId,
        userName: options.metadata?.userName || userId,
        joinedAt: new Date(),
        lastActivity: new Date(),
        permissions: options.permissions
      };

      const participantKey = `room:${roomId}:participant:${userId}`;
      
      // Store participant data
      await this.redis.hmset(participantKey, {
        userId,
        userName: participant.userName,
        joinedAt: participant.joinedAt.toISOString(),
        lastActivity: participant.lastActivity.toISOString(),
        permissions: JSON.stringify(participant.permissions || []),
        isCreator: options.isCreator || false,
        metadata: JSON.stringify(options.metadata || {})
      });

      // Add to participant set
      await this.redis.sadd(participantsKey, userId);

      // Add to user's room list
      await this.redis.sadd(userKey, roomId);

      // Update room last activity
      await this.redis.hset(roomKey, 'lastActivity', new Date().toISOString());

      // Set TTLs
      await this.redis.expire(participantKey, this.TTL);
      await this.redis.expire(participantsKey, this.TTL);
      await this.redis.expire(userKey, this.TTL);
      await this.redis.expire(roomKey, this.TTL);

      logger.debug({
        roomId,
        userId,
        roomType,
        tenantId
      }, 'User joined room');

    } catch (error) {
      logger.error({
        roomId,
        userId,
        error: error.message
      }, 'Failed to join room');
      throw error;
    }
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    try {
      const participantsKey = `room:${roomId}:participants`;
      const participantKey = `room:${roomId}:participant:${userId}`;
      const userKey = `user:${userId}:rooms`;

      // Remove from participant set
      await this.redis.srem(participantsKey, userId);

      // Remove participant data
      await this.redis.del(participantKey);

      // Remove from user's room list
      await this.redis.srem(userKey, roomId);

      // Update room last activity
      const roomKey = `room:${roomId}`;
      await this.redis.hset(roomKey, 'lastActivity', new Date().toISOString());

      // Check if room is now empty
      const participantCount = await this.redis.scard(participantsKey);
      if (participantCount === 0) {
        // Clean up empty room after delay
        setTimeout(() => {
          this.cleanupEmptyRoom(roomId);
        }, 60000); // 1 minute delay
      }

      logger.debug({
        roomId,
        userId,
        remainingParticipants: participantCount
      }, 'User left room');

    } catch (error) {
      logger.error({
        roomId,
        userId,
        error: error.message
      }, 'Failed to leave room');
      throw error;
    }
  }

  async getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
    try {
      const participantsKey = `room:${roomId}:participants`;
      const userIds = await this.redis.smembers(participantsKey);

      const participants: RoomParticipant[] = [];

      for (const userId of userIds) {
        const participantKey = `room:${roomId}:participant:${userId}`;
        const data = await this.redis.hmget(
          participantKey,
          'userId',
          'userName',
          'joinedAt',
          'lastActivity',
          'permissions',
          'isCreator',
          'metadata'
        );

        if (data[0]) {
          participants.push({
            userId: data[0],
            userName: data[1] || userId,
            joinedAt: new Date(data[2] || Date.now()),
            lastActivity: new Date(data[3] || Date.now()),
            permissions: data[4] ? JSON.parse(data[4]) : []
          });
        }
      }

      return participants.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());

    } catch (error) {
      logger.error({
        roomId,
        error: error.message
      }, 'Failed to get room participants');
      return [];
    }
  }

  async getRoom(roomId: string): Promise<Room | null> {
    try {
      const roomKey = `room:${roomId}`;
      const data = await this.redis.hmget(
        roomKey,
        'id',
        'type',
        'tenantId',
        'metadata',
        'createdAt',
        'lastActivity'
      );

      if (!data[0]) {
        return null;
      }

      const participants = await this.getRoomParticipants(roomId);

      return {
        id: data[0],
        type: data[1] as RoomType,
        tenantId: data[2] || undefined,
        metadata: data[3] ? JSON.parse(data[3]) : {},
        participants: new Set(participants.map(p => p.userId)),
        createdAt: new Date(data[4] || Date.now()),
        lastActivity: new Date(data[5] || Date.now())
      };

    } catch (error) {
      logger.error({
        roomId,
        error: error.message
      }, 'Failed to get room');
      return null;
    }
  }

  async getUserRooms(userId: string): Promise<string[]> {
    try {
      const userKey = `user:${userId}:rooms`;
      return await this.redis.smembers(userKey);
    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to get user rooms');
      return [];
    }
  }

  async updateRoomMetadata(
    roomId: string, 
    metadata: Partial<RoomMetadata>, 
    updatedBy: string
  ): Promise<void> {
    try {
      const roomKey = `room:${roomId}`;
      
      // Get current metadata
      const currentMetadataStr = await this.redis.hget(roomKey, 'metadata');
      const currentMetadata = currentMetadataStr ? JSON.parse(currentMetadataStr) : {};
      
      // Merge metadata
      const updatedMetadata = { ...currentMetadata, ...metadata };
      
      // Update room
      await this.redis.hmset(roomKey, {
        metadata: JSON.stringify(updatedMetadata),
        lastActivity: new Date().toISOString()
      });

      // Update indexes if type or tenant changed
      if (metadata.type || metadata.tenantId) {
        await this.reindexRoom(roomId, updatedMetadata);
      }

      logger.info({
        roomId,
        updatedBy,
        changes: Object.keys(metadata)
      }, 'Room metadata updated');

    } catch (error) {
      logger.error({
        roomId,
        updatedBy,
        error: error.message
      }, 'Failed to update room metadata');
      throw error;
    }
  }

  async updateParticipantActivity(roomId: string, userId: string): Promise<void> {
    try {
      const participantKey = `room:${roomId}:participant:${userId}`;
      const roomKey = `room:${roomId}`;
      
      const now = new Date().toISOString();
      
      // Update participant last activity
      await this.redis.hset(participantKey, 'lastActivity', now);
      
      // Update room last activity
      await this.redis.hset(roomKey, 'lastActivity', now);

      // Refresh TTLs
      await this.redis.expire(participantKey, this.TTL);
      await this.redis.expire(roomKey, this.TTL);

    } catch (error) {
      logger.error({
        roomId,
        userId,
        error: error.message
      }, 'Failed to update participant activity');
    }
  }

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      const participantsKey = `room:${roomId}:participants`;
      return (await this.redis.sismember(participantsKey, userId)) === 1;
    } catch (error) {
      logger.error({
        roomId,
        userId,
        error: error.message
      }, 'Failed to check user room membership');
      return false;
    }
  }

  async getRoomsByType(type: RoomType, tenantId?: string, limit = 50): Promise<string[]> {
    try {
      let indexKey: string;
      
      if (tenantId) {
        indexKey = `room_index:${type}:${tenantId}`;
      } else {
        indexKey = `room_index:${type}`;
      }

      return await this.redis.smembers(indexKey);
    } catch (error) {
      logger.error({
        type,
        tenantId,
        error: error.message
      }, 'Failed to get rooms by type');
      return [];
    }
  }

  async deleteRoom(roomId: string, deletedBy: string): Promise<void> {
    try {
      // Get participants to clean up
      const participants = await this.getRoomParticipants(roomId);
      
      // Remove room from all participant's room lists
      for (const participant of participants) {
        const userKey = `user:${participant.userId}:rooms`;
        await this.redis.srem(userKey, roomId);
      }

      // Get room data for cleanup
      const room = await this.getRoom(roomId);
      
      // Remove from indexes
      if (room) {
        await this.removeFromIndexes(roomId, room.metadata as RoomMetadata);
      }

      // Delete all room keys
      const keys = await this.redis.keys(`room:${roomId}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      logger.info({
        roomId,
        deletedBy,
        participantCount: participants.length
      }, 'Room deleted');

    } catch (error) {
      logger.error({
        roomId,
        deletedBy,
        error: error.message
      }, 'Failed to delete room');
      throw error;
    }
  }

  // Utility methods
  private async indexRoom(roomId: string, metadata: RoomMetadata): Promise<void> {
    try {
      // Index by type
      const typeKey = `room_index:${metadata.type}`;
      await this.redis.sadd(typeKey, roomId);
      await this.redis.expire(typeKey, this.TTL);

      // Index by type and tenant
      if (metadata.tenantId) {
        const tenantTypeKey = `room_index:${metadata.type}:${metadata.tenantId}`;
        await this.redis.sadd(tenantTypeKey, roomId);
        await this.redis.expire(tenantTypeKey, this.TTL);
      }

      // Index by tags if present
      if (metadata.tags) {
        for (const tag of metadata.tags) {
          const tagKey = `room_index:tag:${tag}`;
          await this.redis.sadd(tagKey, roomId);
          await this.redis.expire(tagKey, this.TTL);
        }
      }
    } catch (error) {
      logger.error({
        roomId,
        error: error.message
      }, 'Failed to index room');
    }
  }

  private async reindexRoom(roomId: string, metadata: RoomMetadata): Promise<void> {
    // Remove from old indexes (this is simplified - in production you'd track old values)
    // Add to new indexes
    await this.indexRoom(roomId, metadata);
  }

  private async removeFromIndexes(roomId: string, metadata: RoomMetadata): Promise<void> {
    try {
      // Remove from type index
      const typeKey = `room_index:${metadata.type}`;
      await this.redis.srem(typeKey, roomId);

      // Remove from tenant type index
      if (metadata.tenantId) {
        const tenantTypeKey = `room_index:${metadata.type}:${metadata.tenantId}`;
        await this.redis.srem(tenantTypeKey, roomId);
      }

      // Remove from tag indexes
      if (metadata.tags) {
        for (const tag of metadata.tags) {
          const tagKey = `room_index:tag:${tag}`;
          await this.redis.srem(tagKey, roomId);
        }
      }
    } catch (error) {
      logger.error({
        roomId,
        error: error.message
      }, 'Failed to remove room from indexes');
    }
  }

  private async cleanupEmptyRoom(roomId: string): Promise<void> {
    try {
      // Double-check room is still empty
      const participantsKey = `room:${roomId}:participants`;
      const participantCount = await this.redis.scard(participantsKey);
      
      if (participantCount === 0) {
        logger.info({ roomId }, 'Cleaning up empty room');
        
        // Get room data for index cleanup
        const room = await this.getRoom(roomId);
        
        // Delete the room
        if (room) {
          await this.removeFromIndexes(roomId, room.metadata as RoomMetadata);
        }
        
        // Delete all room keys
        const keys = await this.redis.keys(`room:${roomId}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (error) {
      logger.error({
        roomId,
        error: error.message
      }, 'Failed to cleanup empty room');
    }
  }

  // Statistics and monitoring
  async getRoomStats(roomId: string): Promise<{
    participantCount: number;
    createdAt: Date;
    lastActivity: Date;
    totalMessages?: number;
    avgParticipantDuration?: number;
  } | null> {
    try {
      const room = await this.getRoom(roomId);
      if (!room) return null;

      const participantCount = room.participants.size;
      
      // Calculate average participant duration (simplified)
      const participants = await this.getRoomParticipants(roomId);
      const now = Date.now();
      const totalDuration = participants.reduce((sum, p) => 
        sum + (now - p.joinedAt.getTime()), 0
      );
      const avgDuration = participantCount > 0 ? totalDuration / participantCount : 0;

      return {
        participantCount,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity,
        avgParticipantDuration: avgDuration
      };

    } catch (error) {
      logger.error({
        roomId,
        error: error.message
      }, 'Failed to get room stats');
      return null;
    }
  }

  async getGlobalStats(): Promise<{
    totalRooms: number;
    roomsByType: Record<string, number>;
    totalParticipants: number;
    activeRooms: number;
  }> {
    try {
      // Get all room keys
      const roomKeys = await this.redis.keys('room:*:*');
      const mainRoomKeys = roomKeys.filter(key => !key.includes(':participants') && !key.includes(':participant:'));
      
      const totalRooms = mainRoomKeys.length;
      const roomsByType: Record<string, number> = {};
      let totalParticipants = 0;
      let activeRooms = 0;

      // Analyze each room
      for (const roomKey of mainRoomKeys) {
        const roomId = roomKey.replace('room:', '');
        const participantsKey = `room:${roomId}:participants`;
        
        const [typeData, participantCount] = await Promise.all([
          this.redis.hget(roomKey, 'type'),
          this.redis.scard(participantsKey)
        ]);

        if (typeData) {
          roomsByType[typeData] = (roomsByType[typeData] || 0) + 1;
        }

        totalParticipants += participantCount;
        
        if (participantCount > 0) {
          activeRooms++;
        }
      }

      return {
        totalRooms,
        roomsByType,
        totalParticipants,
        activeRooms
      };

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get global room stats');
      return {
        totalRooms: 0,
        roomsByType: {},
        totalParticipants: 0,
        activeRooms: 0
      };
    }
  }
}