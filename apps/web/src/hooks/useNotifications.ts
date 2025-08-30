import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'mention' | 'reaction' | 'invitation' | 'system';
  title: string;
  message: string;
  userId: string;
  tenantId: string;
  conversationId?: string;
  messageId?: string;
  metadata?: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  persistent: boolean;
  expiresAt?: Date;
  createdAt: Date;
  readAt?: Date;
  deliveredAt?: Date;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'button' | 'link' | 'dismiss';
  variant?: 'primary' | 'secondary' | 'danger';
  url?: string;
  onClick?: () => void;
}

export interface NotificationPreferences {
  enabled: boolean;
  types: Record<Notification['type'], boolean>;
  channels: {
    push: boolean;
    email: boolean;
    inApp: boolean;
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;   // HH:mm format
    timezone: string;
  };
  mentions: boolean;
  reactions: boolean;
  invitations: boolean;
  systemAlerts: boolean;
}

export interface UseNotificationsOptions {
  maxNotifications?: number;
  autoMarkAsRead?: boolean;
  autoMarkAsReadDelay?: number;
  enableSound?: boolean;
  enableBrowserNotifications?: boolean;
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  dismiss: (notificationId: string) => void;
  dismissAll: () => void;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => void;
  requestPermission: () => Promise<NotificationPermission>;
  hasPermission: boolean;
  playNotificationSound: () => void;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    maxNotifications = 100,
    autoMarkAsRead = false,
    autoMarkAsReadDelay = 5000,
    enableSound = true,
    enableBrowserNotifications = true
  } = options;

  const { socket, isConnected, emit, on, off } = useWebSocket();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoReadTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize audio for notification sounds
  useEffect(() => {
    if (enableSound) {
      audioRef.current = new Audio('/sounds/notification.mp3');
      audioRef.current.volume = 0.3;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [enableSound]);

  // Check browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setHasPermission(Notification.permission === 'granted');
    }
  }, []);

  // Request browser notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    setHasPermission(permission === 'granted');
    return permission;
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (enableSound && audioRef.current) {
      audioRef.current.play().catch((error) => {
        console.warn('Failed to play notification sound:', error);
      });
    }
  }, [enableSound]);

  // Show browser notification
  const showBrowserNotification = useCallback((notification: Notification) => {
    if (!enableBrowserNotifications || !hasPermission || !('Notification' in window)) {
      return;
    }

    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      icon: '/icons/notification.png',
      tag: notification.id,
      requireInteraction: notification.priority === 'urgent',
      silent: false
    });

    browserNotification.onclick = () => {
      window.focus();
      if (notification.conversationId) {
        // Navigate to conversation - this would need to be implemented based on routing
        window.location.hash = `#/conversations/${notification.conversationId}`;
      }
      browserNotification.close();
    };

    // Auto-close non-urgent notifications
    if (notification.priority !== 'urgent') {
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }
  }, [enableBrowserNotifications, hasPermission]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    if (!socket || !isConnected) return;

    emit('notification_mark_read', { notificationId });
    
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, readAt: new Date() }
          : notification
      )
    );

    // Clear auto-read timeout
    const timeout = autoReadTimeouts.current.get(notificationId);
    if (timeout) {
      clearTimeout(timeout);
      autoReadTimeouts.current.delete(notificationId);
    }
  }, [socket, isConnected, emit]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    if (!socket || !isConnected) return;

    emit('notification_mark_all_read');
    
    setNotifications(prev => 
      prev.map(notification => 
        notification.readAt ? notification : { ...notification, readAt: new Date() }
      )
    );

    // Clear all auto-read timeouts
    autoReadTimeouts.current.forEach(timeout => clearTimeout(timeout));
    autoReadTimeouts.current.clear();
  }, [socket, isConnected, emit]);

  // Dismiss notification
  const dismiss = useCallback((notificationId: string) => {
    if (!socket || !isConnected) return;

    emit('notification_dismiss', { notificationId });
    
    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    // Clear auto-read timeout
    const timeout = autoReadTimeouts.current.get(notificationId);
    if (timeout) {
      clearTimeout(timeout);
      autoReadTimeouts.current.delete(notificationId);
    }
  }, [socket, isConnected, emit]);

  // Dismiss all notifications
  const dismissAll = useCallback(() => {
    if (!socket || !isConnected) return;

    emit('notification_dismiss_all');
    setNotifications([]);

    // Clear all auto-read timeouts
    autoReadTimeouts.current.forEach(timeout => clearTimeout(timeout));
    autoReadTimeouts.current.clear();
  }, [socket, isConnected, emit]);

  // Update notification preferences
  const updatePreferences = useCallback((newPreferences: Partial<NotificationPreferences>) => {
    if (!socket || !isConnected) return;

    emit('notification_preferences_update', newPreferences);
    
    setPreferences(prev => prev ? { ...prev, ...newPreferences } : null);
  }, [socket, isConnected, emit]);

  // Setup auto-read timer for new notifications
  const setupAutoRead = useCallback((notification: Notification) => {
    if (autoMarkAsRead && !notification.readAt && notification.priority !== 'urgent') {
      const timeout = setTimeout(() => {
        markAsRead(notification.id);
      }, autoMarkAsReadDelay);
      
      autoReadTimeouts.current.set(notification.id, timeout);
    }
  }, [autoMarkAsRead, autoMarkAsReadDelay, markAsRead]);

  // Handle new notifications
  const handleNewNotification = useCallback((notification: Notification) => {
    setNotifications(prev => {
      // Remove any existing notification with the same ID
      const filtered = prev.filter(n => n.id !== notification.id);
      
      // Add new notification at the beginning
      const updated = [notification, ...filtered];
      
      // Limit to max notifications
      return updated.slice(0, maxNotifications);
    });

    // Show browser notification
    showBrowserNotification(notification);
    
    // Play sound for high priority notifications
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      playNotificationSound();
    }

    // Setup auto-read timer
    setupAutoRead(notification);
  }, [maxNotifications, showBrowserNotification, playNotificationSound, setupAutoRead]);

  // Setup event listeners
  useEffect(() => {
    if (!socket) return;

    // Notification events
    const handleNotificationReceived = (data: any) => {
      const notification: Notification = {
        ...data,
        createdAt: new Date(data.createdAt),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        readAt: data.readAt ? new Date(data.readAt) : undefined,
        deliveredAt: new Date()
      };
      
      handleNewNotification(notification);
    };

    const handleNotificationRead = (data: any) => {
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === data.notificationId
            ? { ...notification, readAt: new Date(data.readAt) }
            : notification
        )
      );
    };

    const handleNotificationDismissed = (data: any) => {
      setNotifications(prev => prev.filter(n => n.id !== data.notificationId));
    };

    const handlePreferencesUpdated = (data: any) => {
      setPreferences(data.preferences);
    };

    const handleNotificationsLoaded = (data: any) => {
      const loadedNotifications: Notification[] = data.notifications.map((n: any) => ({
        ...n,
        createdAt: new Date(n.createdAt),
        expiresAt: n.expiresAt ? new Date(n.expiresAt) : undefined,
        readAt: n.readAt ? new Date(n.readAt) : undefined,
        deliveredAt: n.deliveredAt ? new Date(n.deliveredAt) : undefined
      }));

      setNotifications(loadedNotifications);
      setPreferences(data.preferences);
      setIsLoading(false);

      // Setup auto-read timers for unread notifications
      loadedNotifications.forEach(notification => {
        if (!notification.readAt) {
          setupAutoRead(notification);
        }
      });
    };

    // Register event listeners
    on('notification_received', handleNotificationReceived);
    on('notification_read', handleNotificationRead);
    on('notification_dismissed', handleNotificationDismissed);
    on('notification_preferences_updated', handlePreferencesUpdated);
    on('notifications_loaded', handleNotificationsLoaded);

    return () => {
      off('notification_received', handleNotificationReceived);
      off('notification_read', handleNotificationRead);
      off('notification_dismissed', handleNotificationDismissed);
      off('notification_preferences_updated', handlePreferencesUpdated);
      off('notifications_loaded', handleNotificationsLoaded);
    };
  }, [socket, on, off, handleNewNotification, setupAutoRead]);

  // Load notifications when connected
  useEffect(() => {
    if (socket && isConnected) {
      setIsLoading(true);
      emit('notification_load', { limit: maxNotifications });
    }
  }, [socket, isConnected, emit, maxNotifications]);

  // Cleanup auto-read timeouts on unmount
  useEffect(() => {
    return () => {
      autoReadTimeouts.current.forEach(timeout => clearTimeout(timeout));
      autoReadTimeouts.current.clear();
    };
  }, []);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.readAt).length;

  return {
    notifications,
    unreadCount,
    preferences,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
    updatePreferences,
    requestPermission,
    hasPermission,
    playNotificationSound
  };
}