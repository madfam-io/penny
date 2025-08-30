import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

export interface WebSocketConfig {
  url?: string;
  transports?: ('websocket' | 'polling')[];
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
  forceNew?: boolean;
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnecting: boolean;
  reconnectAttempt: number;
  lastConnectedAt: Date | null;
  latency: number | null;
}

export interface WebSocketHookReturn {
  socket: Socket | null;
  connectionState: ConnectionState;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  isConnected: boolean;
}

const DEFAULT_CONFIG: WebSocketConfig = {
  url: process.env.REACT_APP_WS_URL || 'ws://localhost:3003',
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  forceNew: false
};

export function useWebSocket(config: WebSocketConfig = {}): WebSocketHookReturn {
  const { user, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const configRef = useRef({ ...DEFAULT_CONFIG, ...config });
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    reconnecting: false,
    reconnectAttempt: 0,
    lastConnectedAt: null,
    latency: null
  });

  // Update connection state helper
  const updateConnectionState = useCallback((updates: Partial<ConnectionState>) => {
    setConnectionState(prev => ({ ...prev, ...updates }));
  }, []);

  // Setup latency monitoring
  const setupLatencyMonitoring = useCallback(() => {
    if (!socketRef.current || pingIntervalRef.current) return;

    pingIntervalRef.current = setInterval(() => {
      const startTime = Date.now();
      
      socketRef.current?.emit('heartbeat', { timestamp: startTime });
      
      const timeoutId = setTimeout(() => {
        updateConnectionState({ latency: null });
      }, 5000); // 5 second timeout

      socketRef.current?.once('pong', (data) => {
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;
        updateConnectionState({ latency });
      });
    }, 30000); // Every 30 seconds
  }, [updateConnectionState]);

  // Cleanup latency monitoring
  const cleanupLatencyMonitoring = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (!user || !token) {
      console.warn('Cannot connect WebSocket without authentication');
      return;
    }

    if (socketRef.current?.connected) {
      return; // Already connected
    }

    updateConnectionState({ 
      connecting: true, 
      error: null, 
      reconnecting: false 
    });

    try {
      // Create socket instance
      socketRef.current = io(configRef.current.url!, {
        transports: configRef.current.transports,
        autoConnect: false,
        reconnection: configRef.current.reconnection,
        reconnectionAttempts: configRef.current.reconnectionAttempts,
        reconnectionDelay: configRef.current.reconnectionDelay,
        timeout: configRef.current.timeout,
        forceNew: configRef.current.forceNew,
        auth: {
          token
        },
        query: {
          userId: user.id,
          tenantId: user.tenantId
        }
      });

      const socket = socketRef.current;

      // Connection event handlers
      socket.on('connect', () => {
        console.log('WebSocket connected:', socket.id);
        updateConnectionState({
          connected: true,
          connecting: false,
          error: null,
          reconnecting: false,
          reconnectAttempt: 0,
          lastConnectedAt: new Date()
        });
        setupLatencyMonitoring();
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        updateConnectionState({
          connected: false,
          connecting: false,
          error: reason === 'io server disconnect' ? 'Server disconnected' : null,
          latency: null
        });
        cleanupLatencyMonitoring();
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        updateConnectionState({
          connected: false,
          connecting: false,
          error: error.message || 'Connection failed',
          reconnecting: false
        });
        cleanupLatencyMonitoring();
      });

      // Reconnection event handlers
      socket.io.on('reconnect', (attemptNumber) => {
        console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        updateConnectionState({
          reconnecting: false,
          reconnectAttempt: 0
        });
      });

      socket.io.on('reconnect_attempt', (attemptNumber) => {
        console.log('WebSocket reconnection attempt:', attemptNumber);
        updateConnectionState({
          reconnecting: true,
          reconnectAttempt: attemptNumber,
          error: null
        });
      });

      socket.io.on('reconnect_error', (error) => {
        console.error('WebSocket reconnection error:', error);
        updateConnectionState({
          error: 'Reconnection failed'
        });
      });

      socket.io.on('reconnect_failed', () => {
        console.error('WebSocket reconnection failed - giving up');
        updateConnectionState({
          reconnecting: false,
          error: 'Failed to reconnect'
        });
      });

      // Authentication events
      socket.on('authenticated', (data) => {
        console.log('WebSocket authenticated:', data);
      });

      socket.on('authentication_error', (error) => {
        console.error('WebSocket authentication error:', error);
        updateConnectionState({
          error: 'Authentication failed'
        });
      });

      socket.on('token_refresh_required', () => {
        console.log('WebSocket token refresh required');
        // Handle token refresh if needed
        // This would typically trigger a token refresh flow
      });

      // Rate limiting
      socket.on('rate_limited', (data) => {
        console.warn('WebSocket rate limited:', data);
        updateConnectionState({
          error: `Rate limited: ${data.eventName}`
        });
      });

      // Generic error handling
      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        updateConnectionState({
          error: error.message || 'Unknown error'
        });
      });

      // Actually connect
      socket.connect();

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      updateConnectionState({
        connecting: false,
        error: 'Failed to initialize connection'
      });
    }
  }, [user, token, updateConnectionState, setupLatencyMonitoring, cleanupLatencyMonitoring]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      cleanupLatencyMonitoring();
      socketRef.current.disconnect();
      socketRef.current = null;
      updateConnectionState({
        connected: false,
        connecting: false,
        reconnecting: false,
        latency: null
      });
    }
  }, [cleanupLatencyMonitoring, updateConnectionState]);

  // Emit event to server
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: WebSocket not connected`);
    }
  }, []);

  // Add event listener
  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    socketRef.current?.on(event, callback);
  }, []);

  // Remove event listener
  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (callback) {
      socketRef.current?.off(event, callback);
    } else {
      socketRef.current?.removeAllListeners(event);
    }
  }, []);

  // Auto-connect when user and token are available
  useEffect(() => {
    if (configRef.current.autoConnect && user && token && !socketRef.current) {
      connect();
    }
  }, [user, token, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupLatencyMonitoring();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [cleanupLatencyMonitoring]);

  // Handle auth changes
  useEffect(() => {
    if (!user || !token) {
      disconnect();
    }
  }, [user, token, disconnect]);

  return {
    socket: socketRef.current,
    connectionState,
    connect,
    disconnect,
    emit,
    on,
    off,
    isConnected: connectionState.connected
  };
}