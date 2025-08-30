import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWebSocket, ConnectionState } from '../hooks/useWebSocket';
import { useNotifications, UseNotificationsReturn } from '../hooks/useNotifications';

export interface WebSocketContextValue {
  notifications: UseNotificationsReturn;
  connect: () => void;
  disconnect: () => void;
  send: (data: any) => void;
  subscribe: (event: string, callback: (data: any) => void) => () => void;
  isConnected?: boolean;
  connectionState?: ConnectionState;
  lastError?: Error | null;
  reconnectAttempts?: number;
  socket?: any;
  emit?: (event: string, data: any) => void;
  on?: (event: string, callback: (data: any) => void) => () => void;
  off?: (event: string, callback: (data: any) => void) => void;
  latency?: number;
  lastHeartbeat?: Date;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export interface WebSocketProviderProps {
  children: ReactNode;
  url?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  enableNotifications?: boolean;
  notificationOptions?: {
    maxNotifications?: number;
    autoMarkAsRead?: boolean;
    autoMarkAsReadDelay?: number;
    enableSound?: boolean;
    enableBrowserNotifications?: boolean;
  };
}

export function WebSocketProvider({
  children,
  url,
  autoConnect = true,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
  heartbeatInterval = 25000,
  enableNotifications = true,
  notificationOptions = {}
}: WebSocketProviderProps) {
  const webSocket = useWebSocket({
    url,
    autoConnect,
    reconnectionAttempts: reconnectAttempts,
    reconnectionDelay: reconnectInterval,
    timeout: heartbeatInterval
  });

  const notifications = useNotifications({
    ...notificationOptions,
    enableBrowserNotifications: notificationOptions.enableBrowserNotifications ?? true,
    enableSound: notificationOptions.enableSound ?? true
  });

  const contextValue: WebSocketContextValue = {
    ...webSocket,
    notifications,
    send: (data: any) => webSocket.emit('message', data),
    subscribe: (event: string, callback: (data: any) => void) => {
      webSocket.on(event, callback);
      return () => webSocket.off(event, callback);
    }
  };

  // Request notification permissions on mount if notifications are enabled
  useEffect(() => {
    if (enableNotifications && !notifications.hasPermission) {
      // Request permission after a small delay to avoid blocking the UI
      const timer = setTimeout(() => {
        notifications.requestPermission().catch((error) => {
          console.warn('Failed to request notification permission:', error);
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [enableNotifications, notifications.hasPermission, notifications.requestPermission]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  
  return context;
}

// Convenience hooks that use the context
export function useSocket() {
  const { socket, isConnected, connectionState, lastError, reconnectAttempts: attempts } = useWebSocketContext();
  
  return {
    socket,
    isConnected,
    connectionState,
    lastError,
    reconnectAttempts: attempts
  };
}

export function useSocketEmit() {
  const { emit } = useWebSocketContext();
  return emit;
}

export function useSocketListen() {
  const { on, off } = useWebSocketContext();
  
  return {
    on,
    off,
    listen: on, // Alias for compatibility
    unlisten: off // Alias for compatibility
  };
}

export function useSocketMetrics() {
  const { latency, reconnectAttempts, lastHeartbeat } = useWebSocketContext();
  
  return {
    latency,
    reconnectAttempts,
    lastHeartbeat
  };
}

export function useSocketNotifications() {
  const { notifications } = useWebSocketContext();
  return notifications;
}