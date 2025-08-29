import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

export interface TypingUser {
  userId: string;
  userName: string;
  startedAt: Date;
}

export interface UseTypingOptions {
  conversationId?: string;
  typingTimeout?: number; // Auto-stop typing after this many ms of inactivity
}

export interface UseTypingReturn {
  typingUsers: TypingUser[];
  isTyping: boolean;
  startTyping: (conversationId?: string) => void;
  stopTyping: (conversationId?: string) => void;
  isUserTyping: (userId: string) => boolean;
  getTypingMessage: () => string;
}

export function useTyping(options: UseTypingOptions = {}): UseTypingReturn {
  const { conversationId, typingTimeout = 3000 } = options;
  const { socket, isConnected, emit, on, off } = useWebSocket();
  
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingConversationRef = useRef<string | null>(null);

  // Start typing indicator
  const startTyping = useCallback((targetConversationId?: string) => {
    const activeConversationId = targetConversationId || conversationId;
    
    if (!socket || !isConnected || !activeConversationId) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Only emit if not already typing in this conversation
    if (!isTyping || lastTypingConversationRef.current !== activeConversationId) {
      emit('typing_start', { conversationId: activeConversationId });
      setIsTyping(true);
      lastTypingConversationRef.current = activeConversationId;
    }

    // Set auto-stop timeout
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeConversationId);
    }, typingTimeout);
  }, [socket, isConnected, conversationId, emit, isTyping, typingTimeout]);

  // Stop typing indicator
  const stopTyping = useCallback((targetConversationId?: string) => {
    const activeConversationId = targetConversationId || conversationId || lastTypingConversationRef.current;
    
    if (!socket || !activeConversationId || !isTyping) return;

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    emit('typing_stop', { conversationId: activeConversationId });
    setIsTyping(false);
    lastTypingConversationRef.current = null;
  }, [socket, conversationId, emit, isTyping]);

  // Check if specific user is typing
  const isUserTyping = useCallback((userId: string) => {
    return typingUsers.some(user => user.userId === userId);
  }, [typingUsers]);

  // Get formatted typing message
  const getTypingMessage = useCallback(() => {
    const count = typingUsers.length;
    
    if (count === 0) return '';
    if (count === 1) return `${typingUsers[0].userName} is typing...`;
    if (count === 2) return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
    if (count === 3) return `${typingUsers[0].userName}, ${typingUsers[1].userName}, and ${typingUsers[2].userName} are typing...`;
    
    return `${typingUsers[0].userName}, ${typingUsers[1].userName}, and ${count - 2} others are typing...`;
  }, [typingUsers]);

  // Setup event listeners
  useEffect(() => {
    if (!socket) return;

    const handleTypingStart = (data: any) => {
      const typingUser: TypingUser = {
        userId: data.userId,
        userName: data.userName,
        startedAt: new Date(data.timestamp)
      };

      setTypingUsers(prev => {
        // Remove existing entry for this user and add new one
        const filtered = prev.filter(user => user.userId !== data.userId);
        return [...filtered, typingUser];
      });
    };

    const handleTypingStop = (data: any) => {
      setTypingUsers(prev => prev.filter(user => user.userId !== data.userId));
    };

    on('typing_start', handleTypingStart);
    on('typing_stop', handleTypingStop);

    return () => {
      off('typing_start', handleTypingStart);
      off('typing_stop', handleTypingStop);
    };
  }, [socket, on, off]);

  // Auto-stop typing when sending message
  useEffect(() => {
    if (!socket) return;

    const handleMessageSent = () => {
      if (isTyping) {
        stopTyping();
      }
    };

    on('message_sent', handleMessageSent);
    on('stream_start', handleMessageSent);

    return () => {
      off('message_sent', handleMessageSent);
      off('stream_start', handleMessageSent);
    };
  }, [socket, on, off, isTyping, stopTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        stopTyping();
      }
    };
  }, [isTyping, stopTyping]);

  return {
    typingUsers,
    isTyping,
    startTyping,
    stopTyping,
    isUserTyping,
    getTypingMessage
  };
}