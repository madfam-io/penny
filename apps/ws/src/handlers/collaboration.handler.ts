import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { 
  AuthenticatedSocket, 
  SocketEvent, 
  CursorUpdateData, 
  CursorUpdateSchema 
} from '../types';
import { z } from 'zod';

// Additional schemas for collaboration
const SelectionUpdateSchema = z.object({
  conversationId: z.string(),
  selection: z.object({
    start: z.object({
      line: z.number().int().nonnegative(),
      column: z.number().int().nonnegative()
    }),
    end: z.object({
      line: z.number().int().nonnegative(),
      column: z.number().int().nonnegative()
    })
  }),
  color: z.string().optional() // User's selection color
});

const CollaborativeEditSchema = z.object({
  conversationId: z.string(),
  operation: z.enum(['insert', 'delete', 'replace']),
  position: z.object({
    line: z.number().int().nonnegative(),
    column: z.number().int().nonnegative()
  }),
  content: z.string().optional(),
  length: z.number().int().nonnegative().optional(), // for delete operations
  timestamp: z.number().int().positive()
});

const DocumentLockSchema = z.object({
  conversationId: z.string(),
  documentId: z.string().optional(),
  action: z.enum(['lock', 'unlock']),
  lockType: z.enum(['read', 'write']).default('write')
});

interface CollaborationState {
  conversationId: string;
  participants: Map<string, ParticipantState>;
  locks: Map<string, LockInfo>;
  lastActivity: Date;
}

interface ParticipantState {
  userId: string;
  userName: string;
  cursor?: {
    line: number;
    column: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
    color: string;
  };
  lastActivity: Date;
  socketId: string;
}

interface LockInfo {
  userId: string;
  userName: string;
  lockType: 'read' | 'write';
  acquiredAt: Date;
  documentId?: string;
}

export class CollaborationHandler {
  private io: SocketIOServer;
  private redis: Redis;
  
  // Collaboration state tracking
  private collaborationSessions: Map<string, CollaborationState> = new Map();
  private userColors: Map<string, string> = new Map(); // userId -> color
  
  // Lock management
  private readonly LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private lockTimers: Map<string, NodeJS.Timeout> = new Map();

  // Default color palette for user cursors/selections
  private readonly USER_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
  ];

  constructor(io: SocketIOServer, redis: Redis) {
    this.io = io;
    this.redis = redis;
  }

  public setupHandlers(): void {
    this.io.on(SocketEvent.CONNECT, (socket: AuthenticatedSocket) => {
      this.setupSocketHandlers(socket);
    });

    // Cleanup stale collaboration sessions
    setInterval(() => {
      this.cleanupStaleSessions();
    }, 60000); // Every minute
  }

  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    if (!socket.user) return;

    // Cursor tracking
    socket.on(SocketEvent.CURSOR_UPDATE, (data) => 
      this.handleCursorUpdate(socket, data)
    );

    // Selection tracking
    socket.on(SocketEvent.SELECTION_UPDATE, (data) => 
      this.handleSelectionUpdate(socket, data)
    );

    // Collaborative editing
    socket.on(SocketEvent.COLLABORATIVE_EDIT, (data) => 
      this.handleCollaborativeEdit(socket, data)
    );

    // Document locking
    socket.on('document_lock', (data) => 
      this.handleDocumentLock(socket, data)
    );

    socket.on('document_unlock', (data) => 
      this.handleDocumentUnlock(socket, data)
    );

    // Join/leave collaboration sessions
    socket.on('join_collaboration', (data) => 
      this.handleJoinCollaboration(socket, data)
    );

    socket.on('leave_collaboration', (data) => 
      this.handleLeaveCollaboration(socket, data)
    );

    // Disconnect cleanup
    socket.on(SocketEvent.DISCONNECT, () => 
      this.handleDisconnect(socket)
    );
  }

  private async handleJoinCollaboration(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { conversationId } = z.object({ conversationId: z.string() }).parse(data);
      const user = socket.user!;

      logger.debug({
        socketId: socket.id,
        userId: user.id,
        conversationId
      }, 'Joining collaboration session');

      // Get or create collaboration session
      let session = this.collaborationSessions.get(conversationId);
      if (!session) {
        session = {
          conversationId,
          participants: new Map(),
          locks: new Map(),
          lastActivity: new Date()
        };
        this.collaborationSessions.set(conversationId, session);
      }

      // Assign user color if not already assigned
      if (!this.userColors.has(user.id)) {
        const usedColors = new Set(Array.from(this.userColors.values()));
        const availableColor = this.USER_COLORS.find(color => !usedColors.has(color)) 
          || this.USER_COLORS[Math.floor(Math.random() * this.USER_COLORS.length)];
        this.userColors.set(user.id, availableColor);
      }

      // Add participant to session
      const participantState: ParticipantState = {
        userId: user.id,
        userName: user.name,
        lastActivity: new Date(),
        socketId: socket.id
      };

      session.participants.set(user.id, participantState);
      session.lastActivity = new Date();

      // Join collaboration room
      await socket.join(`collaboration:${conversationId}`);

      // Notify other participants
      socket.to(`collaboration:${conversationId}`).emit('collaboration_participant_joined', {
        conversationId,
        participant: {
          userId: user.id,
          userName: user.name,
          color: this.userColors.get(user.id),
          joinedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      // Send current session state to the joining user
      const participantsData = Array.from(session.participants.values()).map(p => ({
        userId: p.userId,
        userName: p.userName,
        color: this.userColors.get(p.userId),
        cursor: p.cursor,
        selection: p.selection,
        lastActivity: p.lastActivity.toISOString()
      }));

      const locksData = Array.from(session.locks.entries()).map(([lockKey, lock]) => ({
        lockKey,
        userId: lock.userId,
        userName: lock.userName,
        lockType: lock.lockType,
        acquiredAt: lock.acquiredAt.toISOString(),
        documentId: lock.documentId
      }));

      socket.emit('collaboration_session_joined', {
        conversationId,
        participants: participantsData,
        locks: locksData,
        userColor: this.userColors.get(user.id),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error joining collaboration session');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to join collaboration session',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleLeaveCollaboration(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { conversationId } = z.object({ conversationId: z.string() }).parse(data);
      const user = socket.user!;

      const session = this.collaborationSessions.get(conversationId);
      if (!session) return;

      // Remove participant
      session.participants.delete(user.id);

      // Release any locks held by this user
      const userLocks = Array.from(session.locks.entries())
        .filter(([_, lock]) => lock.userId === user.id);

      for (const [lockKey, _] of userLocks) {
        session.locks.delete(lockKey);
        this.clearLockTimer(lockKey);
        
        // Notify about lock release
        socket.to(`collaboration:${conversationId}`).emit('document_unlocked', {
          conversationId,
          lockKey,
          userId: user.id,
          userName: user.name,
          timestamp: new Date().toISOString()
        });
      }

      // Leave collaboration room
      await socket.leave(`collaboration:${conversationId}`);

      // Notify other participants
      socket.to(`collaboration:${conversationId}`).emit('collaboration_participant_left', {
        conversationId,
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString()
      });

      // Clean up empty session
      if (session.participants.size === 0) {
        this.collaborationSessions.delete(conversationId);
        // Clean up any remaining locks
        for (const lockKey of session.locks.keys()) {
          this.clearLockTimer(lockKey);
        }
      }

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error leaving collaboration session');
    }
  }

  private async handleCursorUpdate(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const cursorData = CursorUpdateSchema.parse(data);
      const user = socket.user!;

      const session = this.collaborationSessions.get(cursorData.conversationId);
      if (!session || !session.participants.has(user.id)) {
        return; // User not in collaboration session
      }

      // Update participant cursor position
      const participant = session.participants.get(user.id)!;
      participant.cursor = cursorData.position;
      participant.lastActivity = new Date();
      session.lastActivity = new Date();

      // Broadcast cursor update to other participants
      socket.to(`collaboration:${cursorData.conversationId}`).emit('cursor_moved', {
        conversationId: cursorData.conversationId,
        userId: user.id,
        userName: user.name,
        cursor: cursorData.position,
        color: this.userColors.get(user.id),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling cursor update');
    }
  }

  private async handleSelectionUpdate(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const selectionData = SelectionUpdateSchema.parse(data);
      const user = socket.user!;

      const session = this.collaborationSessions.get(selectionData.conversationId);
      if (!session || !session.participants.has(user.id)) {
        return;
      }

      // Update participant selection
      const participant = session.participants.get(user.id)!;
      participant.selection = {
        start: selectionData.selection.start,
        end: selectionData.selection.end,
        color: selectionData.color || this.userColors.get(user.id) || '#4ECDC4'
      };
      participant.lastActivity = new Date();
      session.lastActivity = new Date();

      // Broadcast selection update
      socket.to(`collaboration:${selectionData.conversationId}`).emit('selection_changed', {
        conversationId: selectionData.conversationId,
        userId: user.id,
        userName: user.name,
        selection: participant.selection,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling selection update');
    }
  }

  private async handleCollaborativeEdit(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const editData = CollaborativeEditSchema.parse(data);
      const user = socket.user!;

      const session = this.collaborationSessions.get(editData.conversationId);
      if (!session || !session.participants.has(user.id)) {
        return;
      }

      // Check if user has write lock for the document
      const lockKey = `${editData.conversationId}:write`;
      const writeLock = session.locks.get(lockKey);
      
      if (writeLock && writeLock.userId !== user.id) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Document is locked by another user',
          lockedBy: writeLock.userName,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Update participant activity
      const participant = session.participants.get(user.id)!;
      participant.lastActivity = new Date();
      session.lastActivity = new Date();

      // Broadcast edit operation to other participants
      socket.to(`collaboration:${editData.conversationId}`).emit('collaborative_edit', {
        conversationId: editData.conversationId,
        userId: user.id,
        userName: user.name,
        operation: editData.operation,
        position: editData.position,
        content: editData.content,
        length: editData.length,
        timestamp: editData.timestamp,
        serverTimestamp: new Date().toISOString()
      });

      // Store edit in Redis for conflict resolution and history
      await this.storeEdit(editData, user);

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling collaborative edit');
    }
  }

  private async handleDocumentLock(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const lockData = DocumentLockSchema.parse({ ...data, action: 'lock' });
      const user = socket.user!;

      const session = this.collaborationSessions.get(lockData.conversationId);
      if (!session || !session.participants.has(user.id)) {
        return;
      }

      const lockKey = `${lockData.conversationId}:${lockData.lockType}${lockData.documentId ? `:${lockData.documentId}` : ''}`;
      
      // Check if already locked
      if (session.locks.has(lockKey)) {
        const existingLock = session.locks.get(lockKey)!;
        socket.emit('document_lock_failed', {
          message: 'Document already locked',
          lockedBy: existingLock.userName,
          lockType: existingLock.lockType,
          acquiredAt: existingLock.acquiredAt.toISOString(),
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Acquire lock
      const lock: LockInfo = {
        userId: user.id,
        userName: user.name,
        lockType: lockData.lockType,
        acquiredAt: new Date(),
        documentId: lockData.documentId
      };

      session.locks.set(lockKey, lock);

      // Set lock timeout
      const lockTimer = setTimeout(() => {
        session.locks.delete(lockKey);
        this.io.to(`collaboration:${lockData.conversationId}`).emit('document_unlocked', {
          conversationId: lockData.conversationId,
          lockKey,
          userId: user.id,
          userName: user.name,
          reason: 'timeout',
          timestamp: new Date().toISOString()
        });
      }, this.LOCK_TIMEOUT);

      this.lockTimers.set(lockKey, lockTimer);

      // Notify participants
      this.io.to(`collaboration:${lockData.conversationId}`).emit('document_locked', {
        conversationId: lockData.conversationId,
        lockKey,
        userId: user.id,
        userName: user.name,
        lockType: lockData.lockType,
        documentId: lockData.documentId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling document lock');
    }
  }

  private async handleDocumentUnlock(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const unlockData = DocumentLockSchema.parse({ ...data, action: 'unlock' });
      const user = socket.user!;

      const session = this.collaborationSessions.get(unlockData.conversationId);
      if (!session) return;

      const lockKey = `${unlockData.conversationId}:${unlockData.lockType}${unlockData.documentId ? `:${unlockData.documentId}` : ''}`;
      const lock = session.locks.get(lockKey);

      if (!lock || lock.userId !== user.id) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Cannot unlock document - not locked by you',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Release lock
      session.locks.delete(lockKey);
      this.clearLockTimer(lockKey);

      // Notify participants
      this.io.to(`collaboration:${unlockData.conversationId}`).emit('document_unlocked', {
        conversationId: unlockData.conversationId,
        lockKey,
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling document unlock');
    }
  }

  private handleDisconnect(socket: AuthenticatedSocket): void {
    const user = socket.user;
    if (!user) return;

    // Clean up all collaboration sessions this user was part of
    for (const [conversationId, session] of this.collaborationSessions.entries()) {
      if (session.participants.has(user.id)) {
        // Remove participant
        session.participants.delete(user.id);

        // Release any locks
        const userLocks = Array.from(session.locks.entries())
          .filter(([_, lock]) => lock.userId === user.id);

        for (const [lockKey, _] of userLocks) {
          session.locks.delete(lockKey);
          this.clearLockTimer(lockKey);
          
          // Notify about lock release
          this.io.to(`collaboration:${conversationId}`).emit('document_unlocked', {
            conversationId,
            lockKey,
            userId: user.id,
            userName: user.name,
            reason: 'disconnect',
            timestamp: new Date().toISOString()
          });
        }

        // Notify about participant leaving
        this.io.to(`collaboration:${conversationId}`).emit('collaboration_participant_left', {
          conversationId,
          userId: user.id,
          userName: user.name,
          reason: 'disconnect',
          timestamp: new Date().toISOString()
        });

        // Clean up empty session
        if (session.participants.size === 0) {
          this.collaborationSessions.delete(conversationId);
        }
      }
    }
  }

  private async storeEdit(editData: any, user: any): Promise<void> {
    try {
      const editKey = `collaboration:edits:${editData.conversationId}`;
      const edit = {
        userId: user.id,
        userName: user.name,
        operation: editData.operation,
        position: editData.position,
        content: editData.content,
        length: editData.length,
        timestamp: editData.timestamp,
        serverTimestamp: Date.now()
      };

      // Store in Redis with expiration (24 hours)
      await this.redis.lpush(editKey, JSON.stringify(edit));
      await this.redis.expire(editKey, 24 * 60 * 60);
      
      // Keep only last 1000 edits
      await this.redis.ltrim(editKey, 0, 999);
    } catch (error) {
      logger.error({ error: error.message }, 'Error storing collaborative edit');
    }
  }

  private clearLockTimer(lockKey: string): void {
    const timer = this.lockTimers.get(lockKey);
    if (timer) {
      clearTimeout(timer);
      this.lockTimers.delete(lockKey);
    }
  }

  private cleanupStaleSessions(): void {
    const now = new Date();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [conversationId, session] of this.collaborationSessions.entries()) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceLastActivity > staleThreshold) {
        logger.debug({ conversationId }, 'Cleaning up stale collaboration session');
        
        // Release all locks
        for (const lockKey of session.locks.keys()) {
          this.clearLockTimer(lockKey);
        }
        
        this.collaborationSessions.delete(conversationId);
      }
    }
  }

  // Public methods
  public getActiveCollaborations(): string[] {
    return Array.from(this.collaborationSessions.keys());
  }

  public getCollaborationParticipants(conversationId: string): ParticipantState[] {
    const session = this.collaborationSessions.get(conversationId);
    return session ? Array.from(session.participants.values()) : [];
  }

  public getCollaborationMetrics() {
    return {
      activeSessions: this.collaborationSessions.size,
      totalParticipants: Array.from(this.collaborationSessions.values())
        .reduce((sum, session) => sum + session.participants.size, 0),
      activeLocks: Array.from(this.collaborationSessions.values())
        .reduce((sum, session) => sum + session.locks.size, 0),
      activeLockTimers: this.lockTimers.size
    };
  }
}