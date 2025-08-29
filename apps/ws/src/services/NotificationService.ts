import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { NotificationData } from '../types';

interface StoredNotification extends NotificationData {
  userId: string;
  read: boolean;
  delivered: boolean;
  createdAt: Date;
  readAt?: Date;
  deliveredAt?: Date;
}

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  mentions: boolean;
  messages: boolean;
  systemAlerts: boolean;
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
    timezone: string;
  };
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
}

interface NotificationTemplate {
  id: string;
  type: string;
  title: string;
  bodyTemplate: string;
  variables: string[];
  priority: 'low' | 'normal' | 'high';
  channels: ('email' | 'push' | 'inApp')[];
}

interface DeliveryOptions {
  immediate?: boolean;
  email?: boolean;
  push?: boolean;
  respectPreferences?: boolean;
  skipQuietHours?: boolean;
}

interface NotificationStats {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  unreadCount: number;
  deliveryRate: number;
  readRate: number;
}

export class NotificationService {
  private redis: Redis;
  private readonly NOTIFICATION_TTL = 30 * 24 * 60 * 60; // 30 days
  private readonly MAX_NOTIFICATIONS_PER_USER = 1000;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // Core notification operations
  async createNotification(
    userId: string, 
    notification: NotificationData, 
    options: DeliveryOptions = {}
  ): Promise<StoredNotification> {
    try {
      const notificationId = notification.id || this.generateNotificationId();
      
      const storedNotification: StoredNotification = {
        ...notification,
        id: notificationId,
        userId,
        read: false,
        delivered: false,
        createdAt: new Date()
      };

      // Check user preferences
      if (options.respectPreferences !== false) {
        const preferences = await this.getUserPreferences(userId);
        if (!this.shouldSendNotification(notification, preferences, options.skipQuietHours)) {
          logger.debug({
            userId,
            notificationId,
            notificationType: notification.type
          }, 'Notification skipped due to user preferences');
          
          // Still store the notification but mark as delivered
          storedNotification.delivered = true;
          storedNotification.deliveredAt = new Date();
        }
      }

      // Store notification
      await this.storeNotification(storedNotification);

      // Add to user's notification list
      await this.addToUserNotifications(userId, notificationId);

      // Update stats
      await this.updateNotificationStats(userId, 'sent');

      logger.debug({
        notificationId,
        userId,
        type: notification.type,
        priority: notification.priority
      }, 'Notification created');

      return storedNotification;

    } catch (error) {
      logger.error({
        userId,
        notificationId: notification.id,
        error: error.message
      }, 'Failed to create notification');
      throw error;
    }
  }

  async getNotification(notificationId: string): Promise<StoredNotification | null> {
    try {
      const key = `notification:${notificationId}`;
      const data = await this.redis.hgetall(key);

      if (!data.id) {
        return null;
      }

      return this.deserializeNotification(data);

    } catch (error) {
      logger.error({
        notificationId,
        error: error.message
      }, 'Failed to get notification');
      return null;
    }
  }

  async getUserNotifications(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<StoredNotification[]> {
    try {
      const userKey = `user_notifications:${userId}`;
      
      // Get notification IDs (sorted by timestamp, newest first)
      const notificationIds = await this.redis.zrevrange(userKey, offset, offset + limit - 1);
      
      // Get notification data
      const notifications: StoredNotification[] = [];
      for (const notificationId of notificationIds) {
        const notification = await this.getNotification(notificationId);
        if (notification) {
          notifications.push(notification);
        }
      }

      return notifications;

    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to get user notifications');
      return [];
    }
  }

  async getUnreadNotifications(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<StoredNotification[]> {
    try {
      const unreadKey = `user_notifications_unread:${userId}`;
      
      // Get unread notification IDs
      const notificationIds = await this.redis.zrevrange(unreadKey, offset, offset + limit - 1);
      
      // Get notification data
      const notifications: StoredNotification[] = [];
      for (const notificationId of notificationIds) {
        const notification = await this.getNotification(notificationId);
        if (notification && !notification.read) {
          notifications.push(notification);
        }
      }

      return notifications;

    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to get unread notifications');
      return [];
    }
  }

  async markNotificationRead(
    notificationId: string,
    readAt: Date = new Date()
  ): Promise<boolean> {
    try {
      const notification = await this.getNotification(notificationId);
      if (!notification || notification.read) {
        return false;
      }

      // Update notification
      const key = `notification:${notificationId}`;
      await this.redis.hmset(key, {
        read: 'true',
        readAt: readAt.toISOString()
      });

      // Remove from unread list
      const unreadKey = `user_notifications_unread:${notification.userId}`;
      await this.redis.zrem(unreadKey, notificationId);

      // Update stats
      await this.updateNotificationStats(notification.userId, 'read');

      logger.debug({
        notificationId,
        userId: notification.userId,
        readAt: readAt.toISOString()
      }, 'Notification marked as read');

      return true;

    } catch (error) {
      logger.error({
        notificationId,
        error: error.message
      }, 'Failed to mark notification as read');
      return false;
    }
  }

  async markNotificationsRead(
    userId: string,
    notificationIds: string[],
    readAt: Date = new Date()
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    try {
      const pipeline = this.redis.pipeline();
      const unreadKey = `user_notifications_unread:${userId}`;

      for (const notificationId of notificationIds) {
        const notification = await this.getNotification(notificationId);
        
        if (notification && notification.userId === userId && !notification.read) {
          // Mark as read
          pipeline.hmset(`notification:${notificationId}`, {
            read: 'true',
            readAt: readAt.toISOString()
          });

          // Remove from unread list
          pipeline.zrem(unreadKey, notificationId);
          
          success++;
        } else {
          failed++;
        }
      }

      await pipeline.exec();

      // Update stats
      if (success > 0) {
        await this.updateNotificationStats(userId, 'read', success);
      }

      logger.debug({
        userId,
        success,
        failed,
        totalRequested: notificationIds.length
      }, 'Bulk mark notifications as read');

      return { success, failed };

    } catch (error) {
      logger.error({
        userId,
        notificationCount: notificationIds.length,
        error: error.message
      }, 'Failed to mark notifications as read');
      return { success, failed };
    }
  }

  async markNotificationDelivered(
    notificationId: string,
    deliveredAt: Date = new Date()
  ): Promise<boolean> {
    try {
      const notification = await this.getNotification(notificationId);
      if (!notification || notification.delivered) {
        return false;
      }

      // Update notification
      const key = `notification:${notificationId}`;
      await this.redis.hmset(key, {
        delivered: 'true',
        deliveredAt: deliveredAt.toISOString()
      });

      // Update stats
      await this.updateNotificationStats(notification.userId, 'delivered');

      logger.debug({
        notificationId,
        userId: notification.userId,
        deliveredAt: deliveredAt.toISOString()
      }, 'Notification marked as delivered');

      return true;

    } catch (error) {
      logger.error({
        notificationId,
        error: error.message
      }, 'Failed to mark notification as delivered');
      return false;
    }
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const notification = await this.getNotification(notificationId);
      if (!notification) {
        return false;
      }

      const userId = notification.userId;

      // Remove from user notification lists
      const userKey = `user_notifications:${userId}`;
      const unreadKey = `user_notifications_unread:${userId}`;
      
      await this.redis.zrem(userKey, notificationId);
      await this.redis.zrem(unreadKey, notificationId);

      // Delete notification data
      const key = `notification:${notificationId}`;
      await this.redis.del(key);

      logger.debug({
        notificationId,
        userId
      }, 'Notification deleted');

      return true;

    } catch (error) {
      logger.error({
        notificationId,
        error: error.message
      }, 'Failed to delete notification');
      return false;
    }
  }

  async deleteNotifications(userId: string, notificationIds: string[]): Promise<number> {
    let deletedCount = 0;

    try {
      const pipeline = this.redis.pipeline();
      const userKey = `user_notifications:${userId}`;
      const unreadKey = `user_notifications_unread:${userId}`;

      for (const notificationId of notificationIds) {
        // Verify ownership
        const notification = await this.getNotification(notificationId);
        if (notification && notification.userId === userId) {
          // Remove from lists
          pipeline.zrem(userKey, notificationId);
          pipeline.zrem(unreadKey, notificationId);
          
          // Delete notification
          pipeline.del(`notification:${notificationId}`);
          
          deletedCount++;
        }
      }

      await pipeline.exec();

      logger.debug({
        userId,
        deletedCount,
        totalRequested: notificationIds.length
      }, 'Bulk delete notifications');

      return deletedCount;

    } catch (error) {
      logger.error({
        userId,
        notificationCount: notificationIds.length,
        error: error.message
      }, 'Failed to delete notifications');
      return deletedCount;
    }
  }

  async clearAllNotifications(userId: string): Promise<number> {
    try {
      const userKey = `user_notifications:${userId}`;
      const unreadKey = `user_notifications_unread:${userId}`;

      // Get all notification IDs
      const notificationIds = await this.redis.zrange(userKey, 0, -1);
      
      if (notificationIds.length === 0) {
        return 0;
      }

      const pipeline = this.redis.pipeline();

      // Delete all notifications
      for (const notificationId of notificationIds) {
        pipeline.del(`notification:${notificationId}`);
      }

      // Clear user lists
      pipeline.del(userKey);
      pipeline.del(unreadKey);

      await pipeline.exec();

      logger.info({
        userId,
        clearedCount: notificationIds.length
      }, 'All user notifications cleared');

      return notificationIds.length;

    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to clear all notifications');
      return 0;
    }
  }

  // Preferences management
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const key = `notification_preferences:${userId}`;
      const data = await this.redis.hgetall(key);

      if (!Object.keys(data).length) {
        // Return default preferences
        return {
          email: true,
          push: true,
          inApp: true,
          mentions: true,
          messages: true,
          systemAlerts: true,
          frequency: 'immediate'
        };
      }

      return {
        email: data.email === 'true',
        push: data.push === 'true',
        inApp: data.inApp === 'true',
        mentions: data.mentions === 'true',
        messages: data.messages === 'true',
        systemAlerts: data.systemAlerts === 'true',
        quietHours: data.quietHours ? JSON.parse(data.quietHours) : undefined,
        frequency: (data.frequency as any) || 'immediate'
      };

    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to get user preferences');
      
      // Return safe defaults on error
      return {
        email: true,
        push: true,
        inApp: true,
        mentions: true,
        messages: true,
        systemAlerts: true,
        frequency: 'immediate'
      };
    }
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    try {
      const key = `notification_preferences:${userId}`;
      
      // Get current preferences
      const current = await this.getUserPreferences(userId);
      const updated = { ...current, ...preferences };

      // Store updated preferences
      const serialized: Record<string, string> = {
        email: String(updated.email),
        push: String(updated.push),
        inApp: String(updated.inApp),
        mentions: String(updated.mentions),
        messages: String(updated.messages),
        systemAlerts: String(updated.systemAlerts),
        frequency: updated.frequency
      };

      if (updated.quietHours) {
        serialized.quietHours = JSON.stringify(updated.quietHours);
      }

      await this.redis.hmset(key, serialized);
      await this.redis.expire(key, this.NOTIFICATION_TTL);

      logger.debug({
        userId,
        updatedFields: Object.keys(preferences)
      }, 'User notification preferences updated');

    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to update user preferences');
      throw error;
    }
  }

  // Statistics and analytics
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    try {
      const statsKey = `notification_stats:${userId}`;
      const data = await this.redis.hmget(
        statsKey,
        'totalSent',
        'totalDelivered',
        'totalRead'
      );

      const totalSent = parseInt(data[0] || '0');
      const totalDelivered = parseInt(data[1] || '0');
      const totalRead = parseInt(data[2] || '0');

      // Get current unread count
      const unreadKey = `user_notifications_unread:${userId}`;
      const unreadCount = await this.redis.zcard(unreadKey);

      return {
        totalSent,
        totalDelivered,
        totalRead,
        unreadCount,
        deliveryRate: totalSent > 0 ? totalDelivered / totalSent : 0,
        readRate: totalDelivered > 0 ? totalRead / totalDelivered : 0
      };

    } catch (error) {
      logger.error({
        userId,
        error: error.message
      }, 'Failed to get notification stats');
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalRead: 0,
        unreadCount: 0,
        deliveryRate: 0,
        readRate: 0
      };
    }
  }

  async getGlobalStats(): Promise<{
    totalNotifications: number;
    totalUsers: number;
    averageUnreadPerUser: number;
    notificationsByType: Record<string, number>;
    notificationsByPriority: Record<string, number>;
  }> {
    try {
      // Get all user notification keys
      const userKeys = await this.redis.keys('user_notifications:*');
      const totalUsers = userKeys.length;

      let totalNotifications = 0;
      let totalUnread = 0;
      const typeCount: Record<string, number> = {};
      const priorityCount: Record<string, number> = {};

      // Sample recent notifications for analysis
      const notificationKeys = await this.redis.keys('notification:*');
      const sampleSize = Math.min(1000, notificationKeys.length);
      const sampleKeys = notificationKeys.slice(0, sampleSize);

      for (const key of sampleKeys) {
        const data = await this.redis.hmget(key, 'type', 'priority', 'read');
        
        totalNotifications++;
        
        if (data[0]) {
          typeCount[data[0]] = (typeCount[data[0]] || 0) + 1;
        }
        
        if (data[1]) {
          priorityCount[data[1]] = (priorityCount[data[1]] || 0) + 1;
        }
        
        if (data[2] !== 'true') {
          totalUnread++;
        }
      }

      // Extrapolate from sample if needed
      const scaleFactor = notificationKeys.length / sampleSize;
      if (scaleFactor > 1) {
        totalNotifications = Math.round(totalNotifications * scaleFactor);
        totalUnread = Math.round(totalUnread * scaleFactor);
        
        for (const type in typeCount) {
          typeCount[type] = Math.round(typeCount[type] * scaleFactor);
        }
        
        for (const priority in priorityCount) {
          priorityCount[priority] = Math.round(priorityCount[priority] * scaleFactor);
        }
      }

      return {
        totalNotifications,
        totalUsers,
        averageUnreadPerUser: totalUsers > 0 ? totalUnread / totalUsers : 0,
        notificationsByType: typeCount,
        notificationsByPriority: priorityCount
      };

    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to get global notification stats');
      return {
        totalNotifications: 0,
        totalUsers: 0,
        averageUnreadPerUser: 0,
        notificationsByType: {},
        notificationsByPriority: {}
      };
    }
  }

  // Private helper methods
  private async storeNotification(notification: StoredNotification): Promise<void> {
    const key = `notification:${notification.id}`;
    
    const serialized = {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: JSON.stringify(notification.data || {}),
      priority: notification.priority,
      read: String(notification.read),
      delivered: String(notification.delivered),
      createdAt: notification.createdAt.toISOString(),
      expiresAt: notification.expiresAt?.toISOString() || '',
      readAt: notification.readAt?.toISOString() || '',
      deliveredAt: notification.deliveredAt?.toISOString() || ''
    };

    await this.redis.hmset(key, serialized);
    await this.redis.expire(key, this.NOTIFICATION_TTL);
  }

  private deserializeNotification(data: Record<string, string>): StoredNotification {
    return {
      id: data.id,
      userId: data.userId,
      type: data.type as any,
      title: data.title,
      body: data.body,
      data: data.data ? JSON.parse(data.data) : undefined,
      priority: (data.priority as any) || 'normal',
      read: data.read === 'true',
      delivered: data.delivered === 'true',
      createdAt: new Date(data.createdAt),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      readAt: data.readAt ? new Date(data.readAt) : undefined,
      deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : undefined
    };
  }

  private async addToUserNotifications(userId: string, notificationId: string): Promise<void> {
    const userKey = `user_notifications:${userId}`;
    const unreadKey = `user_notifications_unread:${userId}`;
    const timestamp = Date.now();

    // Add to main list
    await this.redis.zadd(userKey, timestamp, notificationId);

    // Add to unread list
    await this.redis.zadd(unreadKey, timestamp, notificationId);

    // Maintain list size limits
    await this.redis.zremrangebyrank(userKey, 0, -(this.MAX_NOTIFICATIONS_PER_USER + 1));
    await this.redis.zremrangebyrank(unreadKey, 0, -(this.MAX_NOTIFICATIONS_PER_USER + 1));

    // Set TTL
    await this.redis.expire(userKey, this.NOTIFICATION_TTL);
    await this.redis.expire(unreadKey, this.NOTIFICATION_TTL);
  }

  private async updateNotificationStats(
    userId: string,
    action: 'sent' | 'delivered' | 'read',
    count = 1
  ): Promise<void> {
    try {
      const statsKey = `notification_stats:${userId}`;
      
      const field = action === 'sent' ? 'totalSent' : 
                   action === 'delivered' ? 'totalDelivered' : 'totalRead';
      
      await this.redis.hincrby(statsKey, field, count);
      await this.redis.expire(statsKey, this.NOTIFICATION_TTL);

    } catch (error) {
      // Don't throw - stats are not critical
      logger.debug({
        userId,
        action,
        count,
        error: error.message
      }, 'Failed to update notification stats');
    }
  }

  private shouldSendNotification(
    notification: NotificationData,
    preferences: NotificationPreferences,
    skipQuietHours = false
  ): boolean {
    // Check notification type preferences
    switch (notification.type) {
      case 'message':
        if (!preferences.messages) return false;
        break;
      case 'mention':
        if (!preferences.mentions) return false;
        break;
      case 'system':
        if (!preferences.systemAlerts) return false;
        break;
    }

    // Check quiet hours
    if (!skipQuietHours && preferences.quietHours?.enabled) {
      const now = new Date();
      const currentTime = now.toTimeString().substring(0, 5); // HH:MM
      
      if (this.isInQuietHours(currentTime, preferences.quietHours)) {
        return false;
      }
    }

    return true;
  }

  private isInQuietHours(
    currentTime: string,
    quietHours: NonNullable<NotificationPreferences['quietHours']>
  ): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(quietHours.start);
    const end = this.timeToMinutes(quietHours.end);

    if (start <= end) {
      // Normal range (e.g., 22:00 to 08:00 next day)
      return current >= start && current <= end;
    } else {
      // Overnight range (e.g., 22:00 to 08:00 next day)
      return current >= start || current <= end;
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Cleanup expired notifications
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // Get all notification keys
      const keys = await this.redis.keys('notification:*');
      
      for (const key of keys) {
        const expiresAtStr = await this.redis.hget(key, 'expiresAt');
        
        if (expiresAtStr) {
          const expiresAt = new Date(expiresAtStr).getTime();
          
          if (now > expiresAt) {
            const notificationId = key.replace('notification:', '');
            await this.deleteNotification(notificationId);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info({ cleanedCount }, 'Cleaned up expired notifications');
      }

      return cleanedCount;

    } catch (error) {
      logger.error({
        error: error.message
      }, 'Failed to cleanup expired notifications');
      return 0;
    }
  }
}