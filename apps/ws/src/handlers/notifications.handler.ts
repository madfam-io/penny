import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { 
  AuthenticatedSocket, 
  SocketEvent, 
  NotificationData, 
  NotificationSchema 
} from '../types';
import { NotificationService } from '../services/NotificationService';
import { z } from 'zod';

// Additional schemas for notification handling
const NotificationReadSchema = z.object({
  notificationIds: z.array(z.string()),
  readAt: z.date().optional()
});

const NotificationPreferencesSchema = z.object({
  email: z.boolean().default(true),
  push: z.boolean().default(true),
  inApp: z.boolean().default(true),
  mentions: z.boolean().default(true),
  messages: z.boolean().default(true),
  systemAlerts: z.boolean().default(true)
});

const BulkNotificationSchema = z.object({
  userIds: z.array(z.string()),
  notification: NotificationSchema,
  deliveryOptions: z.object({
    immediate: z.boolean().default(true),
    email: z.boolean().default(false),
    push: z.boolean().default(false)
  }).optional()
});

interface NotificationQueue {
  userId: string;
  notifications: NotificationData[];
  lastDeliveryAttempt?: Date;
  retryCount: number;
}

interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  averageDeliveryTime: number;
}

export class NotificationHandler {
  private io: SocketIOServer;
  private redis: Redis;
  private notificationService: NotificationService;
  
  // Notification queues for offline users
  private offlineQueues: Map<string, NotificationQueue> = new Map();
  
  // Delivery tracking
  private deliveryTracking: Map<string, Date> = new Map();
  private metrics: NotificationMetrics = {
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalFailed: 0,
    averageDeliveryTime: 0
  };

  // Configuration
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  constructor(io: SocketIOServer, redis: Redis) {
    this.io = io;
    this.redis = redis;
    this.notificationService = new NotificationService(redis);

    // Setup periodic queue processing
    setInterval(() => {
      this.processOfflineQueues();
    }, 30000); // Every 30 seconds

    // Setup metrics collection
    setInterval(() => {
      this.updateMetrics();
    }, 60000); // Every minute
  }

  public setupHandlers(): void {
    this.io.on(SocketEvent.CONNECT, (socket: AuthenticatedSocket) => {
      this.setupSocketHandlers(socket);
      this.handleUserOnline(socket);
    });
  }

  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    if (!socket.user) return;

    // Notification management
    socket.on(SocketEvent.NOTIFICATION_READ, (data) => 
      this.handleNotificationRead(socket, data)
    );

    socket.on('notification_preferences', (data) => 
      this.handleNotificationPreferences(socket, data)
    );

    socket.on('get_notifications', (data) => 
      this.handleGetNotifications(socket, data)
    );

    socket.on('clear_notifications', (data) => 
      this.handleClearNotifications(socket, data)
    );

    // Delivery acknowledgments
    socket.on(SocketEvent.NOTIFICATION_DELIVERED, (data) => 
      this.handleNotificationDelivered(socket, data)
    );

    // Admin/system events
    socket.on('send_bulk_notification', (data) => 
      this.handleBulkNotification(socket, data)
    );

    socket.on('send_system_notification', (data) => 
      this.handleSystemNotification(socket, data)
    );

    // Disconnect handling
    socket.on(SocketEvent.DISCONNECT, () => 
      this.handleUserOffline(socket)
    );
  }

  private async handleUserOnline(socket: AuthenticatedSocket): Promise<void> {
    const user = socket.user!;

    try {
      // Check for queued offline notifications
      const queue = this.offlineQueues.get(user.id);
      if (queue && queue.notifications.length > 0) {
        logger.debug({
          userId: user.id,
          queuedNotifications: queue.notifications.length
        }, 'Delivering queued notifications to user coming online');

        // Deliver queued notifications
        for (const notification of queue.notifications) {
          await this.deliverNotificationToSocket(socket, notification);
        }

        // Clear the queue
        this.offlineQueues.delete(user.id);
      }

      // Get recent unread notifications from storage
      const unreadNotifications = await this.notificationService.getUnreadNotifications(user.id);
      
      if (unreadNotifications.length > 0) {
        socket.emit('notifications_sync', {
          notifications: unreadNotifications,
          timestamp: new Date().toISOString()
        });
      }

      // Get notification preferences
      const preferences = await this.notificationService.getUserPreferences(user.id);
      socket.emit('notification_preferences', {
        preferences,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        userId: user.id,
        error: error.message
      }, 'Error handling user online for notifications');
    }
  }

  private handleUserOffline(socket: AuthenticatedSocket): void {
    const user = socket.user;
    if (!user) return;

    // No immediate action needed - notifications will be queued
    // when they're sent and user is offline
  }

  private async handleNotificationRead(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const readData = NotificationReadSchema.parse(data);
      const user = socket.user!;

      await this.notificationService.markNotificationsRead(
        user.id, 
        readData.notificationIds,
        readData.readAt || new Date()
      );

      // Update metrics
      this.metrics.totalRead += readData.notificationIds.length;

      socket.emit('notifications_read', {
        notificationIds: readData.notificationIds,
        readAt: (readData.readAt || new Date()).toISOString(),
        timestamp: new Date().toISOString()
      });

      logger.debug({
        userId: user.id,
        notificationIds: readData.notificationIds
      }, 'Notifications marked as read');

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error marking notifications as read');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to mark notifications as read',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleNotificationPreferences(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const preferences = NotificationPreferencesSchema.parse(data);
      const user = socket.user!;

      await this.notificationService.updateUserPreferences(user.id, preferences);

      socket.emit('notification_preferences_updated', {
        preferences,
        timestamp: new Date().toISOString()
      });

      logger.debug({
        userId: user.id,
        preferences
      }, 'Notification preferences updated');

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error updating notification preferences');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to update notification preferences',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleGetNotifications(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        unreadOnly = false 
      } = data as { limit?: number; offset?: number; unreadOnly?: boolean };

      const user = socket.user!;

      const notifications = unreadOnly 
        ? await this.notificationService.getUnreadNotifications(user.id, limit, offset)
        : await this.notificationService.getUserNotifications(user.id, limit, offset);

      socket.emit('notifications_list', {
        notifications,
        hasMore: notifications.length === limit,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error getting notifications');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to get notifications',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleClearNotifications(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { 
        notificationIds, 
        clearAll = false 
      } = data as { notificationIds?: string[]; clearAll?: boolean };

      const user = socket.user!;

      if (clearAll) {
        await this.notificationService.clearAllNotifications(user.id);
        socket.emit('notifications_cleared', {
          clearedAll: true,
          timestamp: new Date().toISOString()
        });
      } else if (notificationIds && notificationIds.length > 0) {
        await this.notificationService.deleteNotifications(user.id, notificationIds);
        socket.emit('notifications_cleared', {
          notificationIds,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error clearing notifications');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to clear notifications',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleNotificationDelivered(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const { notificationId, deliveredAt } = data as { notificationId: string; deliveredAt?: string };
      
      // Track delivery time
      const deliveryKey = `${socket.user!.id}:${notificationId}`;
      const sentTime = this.deliveryTracking.get(deliveryKey);
      
      if (sentTime) {
        const deliveryTime = Date.now() - sentTime.getTime();
        this.updateAverageDeliveryTime(deliveryTime);
        this.deliveryTracking.delete(deliveryKey);
      }

      this.metrics.totalDelivered++;

      // Mark as delivered in storage
      await this.notificationService.markNotificationDelivered(
        notificationId,
        new Date(deliveredAt || Date.now())
      );

    } catch (error) {
      logger.error({
        socketId: socket.id,
        error: error.message,
        data
      }, 'Error handling notification delivered');
    }
  }

  private async handleBulkNotification(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      // Check if user has permission to send bulk notifications
      const user = socket.user!;
      if (!user.permissions?.includes('admin') && !user.permissions?.includes('send_notifications')) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Insufficient permissions to send bulk notifications',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const bulkData = BulkNotificationSchema.parse(data);

      let successCount = 0;
      let failureCount = 0;

      for (const targetUserId of bulkData.userIds) {
        try {
          await this.sendNotificationToUser(targetUserId, bulkData.notification, {
            immediate: bulkData.deliveryOptions?.immediate ?? true,
            email: bulkData.deliveryOptions?.email ?? false,
            push: bulkData.deliveryOptions?.push ?? false
          });
          successCount++;
        } catch (error) {
          logger.error({
            targetUserId,
            error: error.message
          }, 'Failed to send bulk notification to user');
          failureCount++;
        }
      }

      socket.emit('bulk_notification_sent', {
        totalTargets: bulkData.userIds.length,
        successCount,
        failureCount,
        timestamp: new Date().toISOString()
      });

      logger.info({
        senderId: user.id,
        totalTargets: bulkData.userIds.length,
        successCount,
        failureCount
      }, 'Bulk notification sent');

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling bulk notification');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to send bulk notification',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async handleSystemNotification(socket: AuthenticatedSocket, data: unknown): Promise<void> {
    try {
      const user = socket.user!;
      
      // Check admin permissions
      if (!user.permissions?.includes('admin')) {
        socket.emit(SocketEvent.ERROR, {
          message: 'Insufficient permissions to send system notifications',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { notification, tenantId } = data as { 
        notification: NotificationData; 
        tenantId?: string;
      };

      // Send to all users in tenant or all users (system-wide)
      if (tenantId) {
        await this.sendTenantNotification(tenantId, notification);
      } else {
        await this.sendSystemNotification(notification);
      }

      socket.emit('system_notification_sent', {
        tenantId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({
        socketId: socket.id,
        userId: socket.user?.id,
        error: error.message,
        data
      }, 'Error handling system notification');

      socket.emit(SocketEvent.ERROR, {
        message: 'Failed to send system notification',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Public notification sending methods
  public async sendNotificationToUser(
    userId: string, 
    notification: NotificationData,
    options: { immediate?: boolean; email?: boolean; push?: boolean } = {}
  ): Promise<void> {
    try {
      this.metrics.totalSent++;

      // Store notification
      const storedNotification = await this.notificationService.createNotification(
        userId, 
        notification
      );

      // Check if user is online
      const userSockets = await this.io.in(`user:${userId}`).fetchSockets();
      
      if (userSockets.length > 0 && options.immediate !== false) {
        // User is online, deliver immediately
        for (const socket of userSockets) {
          await this.deliverNotificationToSocket(socket as AuthenticatedSocket, storedNotification);
        }
      } else {
        // User is offline, add to queue
        this.addToOfflineQueue(userId, storedNotification);
      }

      // Handle additional delivery methods
      if (options.email) {
        await this.sendEmailNotification(userId, notification);
      }

      if (options.push) {
        await this.sendPushNotification(userId, notification);
      }

    } catch (error) {
      this.metrics.totalFailed++;
      logger.error({
        userId,
        notification: notification.id,
        error: error.message
      }, 'Failed to send notification to user');
      throw error;
    }
  }

  public async sendTenantNotification(tenantId: string, notification: NotificationData): Promise<void> {
    // Broadcast to all users in tenant
    this.io.to(`tenant:${tenantId}`).emit(SocketEvent.NOTIFICATION, {
      ...notification,
      timestamp: new Date().toISOString()
    });

    this.metrics.totalSent++;
  }

  public async sendSystemNotification(notification: NotificationData): Promise<void> {
    // Broadcast to all connected users
    this.io.emit(SocketEvent.NOTIFICATION, {
      ...notification,
      timestamp: new Date().toISOString()
    });

    this.metrics.totalSent++;
  }

  private async deliverNotificationToSocket(
    socket: AuthenticatedSocket, 
    notification: NotificationData
  ): Promise<void> {
    // Track delivery timing
    const deliveryKey = `${socket.user!.id}:${notification.id}`;
    this.deliveryTracking.set(deliveryKey, new Date());

    socket.emit(SocketEvent.NOTIFICATION, {
      ...notification,
      timestamp: new Date().toISOString()
    });

    logger.debug({
      userId: socket.user!.id,
      notificationId: notification.id,
      type: notification.type
    }, 'Notification delivered to socket');
  }

  private addToOfflineQueue(userId: string, notification: NotificationData): void {
    let queue = this.offlineQueues.get(userId);
    
    if (!queue) {
      queue = {
        userId,
        notifications: [],
        retryCount: 0
      };
      this.offlineQueues.set(userId, queue);
    }

    // Prevent queue from growing too large
    if (queue.notifications.length >= this.MAX_QUEUE_SIZE) {
      queue.notifications.shift(); // Remove oldest notification
    }

    queue.notifications.push(notification);

    logger.debug({
      userId,
      queueSize: queue.notifications.length,
      notificationId: notification.id
    }, 'Added notification to offline queue');
  }

  private async processOfflineQueues(): Promise<void> {
    for (const [userId, queue] of this.offlineQueues.entries()) {
      try {
        // Check if user is now online
        const userSockets = await this.io.in(`user:${userId}`).fetchSockets();
        
        if (userSockets.length > 0) {
          // User is online, deliver queued notifications
          for (const notification of queue.notifications) {
            for (const socket of userSockets) {
              await this.deliverNotificationToSocket(socket as AuthenticatedSocket, notification);
            }
          }
          
          // Clear queue
          this.offlineQueues.delete(userId);
          
          logger.debug({
            userId,
            deliveredCount: queue.notifications.length
          }, 'Delivered queued notifications to user who came online');
        } else if (queue.retryCount < this.MAX_RETRY_ATTEMPTS) {
          // User still offline, increment retry count
          queue.retryCount++;
          queue.lastDeliveryAttempt = new Date();
        } else {
          // Max retries reached, move to persistent storage
          await this.moveQueueToPersistentStorage(queue);
          this.offlineQueues.delete(userId);
        }
      } catch (error) {
        logger.error({
          userId,
          error: error.message
        }, 'Error processing offline notification queue');
      }
    }
  }

  private async moveQueueToPersistentStorage(queue: NotificationQueue): Promise<void> {
    try {
      for (const notification of queue.notifications) {
        await this.notificationService.createNotification(queue.userId, notification);
      }
      
      logger.info({
        userId: queue.userId,
        notificationCount: queue.notifications.length
      }, 'Moved offline queue to persistent storage');
    } catch (error) {
      logger.error({
        userId: queue.userId,
        error: error.message
      }, 'Failed to move offline queue to persistent storage');
    }
  }

  private async sendEmailNotification(userId: string, notification: NotificationData): Promise<void> {
    // Implementation would depend on your email service
    // This is a placeholder for email delivery
    logger.debug({
      userId,
      notificationId: notification.id
    }, 'Email notification would be sent here');
  }

  private async sendPushNotification(userId: string, notification: NotificationData): Promise<void> {
    // Implementation would depend on your push notification service
    // This is a placeholder for push delivery
    logger.debug({
      userId,
      notificationId: notification.id
    }, 'Push notification would be sent here');
  }

  private updateAverageDeliveryTime(deliveryTime: number): void {
    if (this.metrics.totalDelivered === 0) {
      this.metrics.averageDeliveryTime = deliveryTime;
    } else {
      this.metrics.averageDeliveryTime = 
        (this.metrics.averageDeliveryTime + deliveryTime) / 2;
    }
  }

  private updateMetrics(): void {
    // Could publish metrics to monitoring system here
    logger.debug(this.metrics, 'Notification metrics update');
  }

  // Public methods for external use
  public getOfflineQueueSize(userId: string): number {
    return this.offlineQueues.get(userId)?.notifications.length || 0;
  }

  public getMetrics(): NotificationMetrics {
    return { ...this.metrics };
  }

  public getQueueMetrics() {
    return {
      totalQueues: this.offlineQueues.size,
      totalQueuedNotifications: Array.from(this.offlineQueues.values())
        .reduce((sum, queue) => sum + queue.notifications.length, 0),
      pendingDeliveries: this.deliveryTracking.size
    };
  }
}