import { useState, useEffect, useCallback, useRef } from 'react';

export interface WebSocketMessage {
  type: string;
  data?: any;
  messageId?: string;
  conversationId?: string;
  content?: string;
  error?: string;
  timestamp?: string;
}

interface UseWebSocketOptions {
  url: string;
  token?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export function useWebSocket({
  url,
  token,
  autoConnect = true,
  reconnectAttempts = 3,
  reconnectDelay = 3000,
  onMessage,
  onOpen,
  onClose,
  onError,
}: UseWebSocketOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [messageHistory, setMessageHistory] = useState<WebSocketMessage[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionState(ConnectionState.CONNECTED);
        reconnectCountRef.current = 0;
        
        // Authenticate if token provided
        if (token) {
          ws.send(JSON.stringify({
            type: 'authenticate',
            token,
          }));
        }

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          
          setLastMessage(message);
          setMessageHistory(prev => [...prev, message]);
          
          // Handle specific message types
          handleMessage(message);
          
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionState(ConnectionState.ERROR);
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionState(ConnectionState.DISCONNECTED);
        wsRef.current = null;
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Attempt reconnection
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          console.log(`Reconnecting... (attempt ${reconnectCountRef.current}/${reconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }

        onClose?.();
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnectionState(ConnectionState.ERROR);
    }
  }, [url, token, reconnectAttempts, reconnectDelay, onMessage, onOpen, onClose, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    if (wsRef.current) {
      reconnectCountRef.current = reconnectAttempts; // Prevent auto-reconnect
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [reconnectAttempts]);

  // Send message through WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageToSend = typeof message === 'string' 
        ? message 
        : JSON.stringify(message);
      
      wsRef.current.send(messageToSend);
      return true;
    } else {
      console.warn('WebSocket is not connected');
      return false;
    }
  }, []);

  // Send chat message
  const sendChatMessage = useCallback((content: string, conversationId?: string, artifacts?: any[]) => {
    return sendMessage({
      type: 'message',
      conversationId,
      content,
      artifacts,
    });
  }, [sendMessage]);

  // Execute tool
  const executeTool = useCallback((tool: string, params: any) => {
    return sendMessage({
      type: 'tool_execute',
      tool,
      params,
    });
  }, [sendMessage]);

  // Send typing indicator
  const sendTyping = useCallback((conversationId: string) => {
    return sendMessage({
      type: 'typing',
      conversationId,
    });
  }, [sendMessage]);

  // Handle specific message types
  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'authenticated':
        console.log('Successfully authenticated');
        break;
      case 'error':
        console.error('Server error:', message.error);
        break;
      case 'pong':
        // Heartbeat response
        break;
      default:
        // Handle other message types
        break;
    }
  };

  // Clear message history
  const clearHistory = useCallback(() => {
    setMessageHistory([]);
    setLastMessage(null);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // Only run once on mount/unmount

  // Reconnect if URL or token changes
  useEffect(() => {
    if (wsRef.current) {
      disconnect();
      connect();
    }
  }, [url, token]);

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    lastMessage,
    messageHistory,
    connect,
    disconnect,
    sendMessage,
    sendChatMessage,
    executeTool,
    sendTyping,
    clearHistory,
  };
}