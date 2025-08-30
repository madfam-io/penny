import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';

export interface Message {
  id: string;
  conversationId: string;
  userId: string | null;
  content: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'system' | 'tool_call' | 'tool_result' | 'error';
  parentMessageId?: string;
  metadata: Record<string, unknown>;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  createdAt: Date;
  updatedAt: Date;
  reactions?: Record<string, string[]>; // emoji -> userIds
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'executing' | 'completed' | 'error';
  executedAt?: Date;
}

export interface SendMessageOptions {
  parentMessageId?: string;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
}

export interface StreamingMessage {
  id: string;
  content: string;
  isComplete: boolean;
  toolCalls: ToolCall[];
}

export interface UseChatOptions {
  conversationId?: string;
  autoJoin?: boolean;
  enableStreaming?: boolean;
  maxMessages?: number;
}

export interface ChatState {
  messages: Message[];
  streamingMessage: StreamingMessage | null;
  isLoading: boolean;
  error: string | null;
  participants: string[];
  typingUsers: string[];
  hasMore: boolean;
}

export interface UseChatReturn extends ChatState {
  // Message operations
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string, action: 'add' | 'remove') => Promise<void>;
  markAsRead: (messageId?: string) => Promise<void>;
  
  // Conversation management
  joinConversation: (conversationId: string) => Promise<void>;
  leaveConversation: () => Promise<void>;
  loadMessages: (limit?: number, offset?: number) => Promise<void>;
  
  // Pagination
  hasMore: boolean;
  
  // Streaming
  streamCompletion: (content: string, options?: { model?: string; temperature?: number }) => Promise<void>;
  
  // Utility
  clearMessages: () => void;
  getMessageById: (messageId: string) => Message | undefined;
  isUserTyping: (userId: string) => boolean;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { conversationId, autoJoin = true, enableStreaming = true, maxMessages = 100 } = options;
  const { socket, isConnected, emit, on, off } = useWebSocket();
  
  const [state, setState] = useState<ChatState>({
    messages: [],
    streamingMessage: null,
    isLoading: false,
    error: null,
    participants: [],
    typingUsers: [],
    hasMore: false
  });

  const conversationIdRef = useRef<string | null>(null);
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update state helper
  const updateState = useCallback((updates: Partial<ChatState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Join conversation
  const joinConversation = useCallback(async (newConversationId: string) => {
    if (!socket || !isConnected) {
      throw new Error('WebSocket not connected');
    }

    // Leave current conversation if any
    if (conversationIdRef.current && conversationIdRef.current !== newConversationId) {
      emit('leave_conversation', { conversationId: conversationIdRef.current });
    }

    conversationIdRef.current = newConversationId;
    updateState({ isLoading: true, error: null });

    try {
      emit('join_conversation', { 
        conversationId: newConversationId 
      });
    } catch (error) {
      updateState({ 
        isLoading: false, 
        error: 'Failed to join conversation' 
      });
      throw error;
    }
  }, [socket, isConnected, emit, updateState]);

  // Leave conversation
  const leaveConversation = useCallback(async () => {
    if (!socket || !conversationIdRef.current) return;

    emit('leave_conversation', { 
      conversationId: conversationIdRef.current 
    });
    
    conversationIdRef.current = null;
    updateState({
      messages: [],
      participants: [],
      typingUsers: []
    });
  }, [socket, emit, updateState]);

  // Send message
  const sendMessage = useCallback(async (content: string, options: SendMessageOptions = {}) => {
    if (!socket || !conversationIdRef.current) {
      throw new Error('No active conversation');
    }

    const messageData = {
      conversationId: conversationIdRef.current,
      content,
      parentMessageId: options.parentMessageId,
      attachments: options.attachments || [],
      metadata: options.metadata || {}
    };

    emit('send_message', messageData);
  }, [socket, emit]);

  // Stream completion
  const streamCompletion = useCallback(async (
    content: string, 
    options: { model?: string; temperature?: number } = {}
  ) => {
    if (!socket || !conversationIdRef.current || !enableStreaming) {
      throw new Error('Streaming not available');
    }

    const streamData = {
      conversationId: conversationIdRef.current,
      content,
      model: options.model,
      temperature: options.temperature,
      artifactsEnabled: true
    };

    updateState({ streamingMessage: { id: '', content: '', isComplete: false, toolCalls: [] } });
    emit('stream_completion', streamData);
  }, [socket, emit, enableStreaming, updateState]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, content: string) => {
    if (!socket) throw new Error('WebSocket not connected');

    emit('edit_message', { messageId, content });
  }, [socket, emit]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!socket) throw new Error('WebSocket not connected');

    emit('delete_message', { messageId });
  }, [socket, emit]);

  // React to message
  const reactToMessage = useCallback(async (
    messageId: string, 
    emoji: string, 
    action: 'add' | 'remove'
  ) => {
    if (!socket) throw new Error('WebSocket not connected');

    emit('message_reaction', { messageId, reaction: emoji, action });
  }, [socket, emit]);

  // Mark message as read
  const markAsRead = useCallback(async (messageId?: string) => {
    if (!socket || !conversationIdRef.current) return;

    emit('message_read', { 
      conversationId: conversationIdRef.current,
      messageId: messageId || null
    });
  }, [socket, emit]);

  // Load messages
  const loadMessages = useCallback(async (limit = 50, offset = 0) => {
    if (!socket || !conversationIdRef.current) return;

    updateState({ isLoading: true });
    emit('get_conversation_messages', {
      conversationId: conversationIdRef.current,
      limit,
      offset
    });
  }, [socket, emit, updateState]);

  // Clear messages
  const clearMessages = useCallback(() => {
    updateState({ messages: [] });
  }, [updateState]);

  // Get message by ID
  const getMessageById = useCallback((messageId: string) => {
    return state.messages.find(msg => msg.id === messageId);
  }, [state.messages]);

  // Check if user is typing
  const isUserTyping = useCallback((userId: string) => {
    return state.typingUsers.includes(userId);
  }, [state.typingUsers]);

  // Setup socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Conversation events
    const handleConversationJoined = (data: any) => {
      updateState({ 
        isLoading: false, 
        participants: data.activeUsers || [],
        error: null 
      });
    };

    const handleConversationMessages = (data: any) => {
      const messages = data.messages.map((msg: any) => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
        updatedAt: new Date(msg.updatedAt)
      }));
      
      updateState({ 
        messages: messages.slice(-maxMessages),
        isLoading: false 
      });
    };

    // Message events
    const handleMessageCreated = (data: any) => {
      const message = {
        ...data.message,
        createdAt: new Date(data.message.createdAt),
        updatedAt: new Date(data.message.updatedAt)
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, message].slice(-maxMessages),
        streamingMessage: null // Clear streaming message if any
      }));
    };

    const handleMessageUpdated = (data: any) => {
      const updatedMessage = {
        ...data.message,
        updatedAt: new Date(data.message.updatedAt)
      };

      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === updatedMessage.id ? updatedMessage : msg
        )
      }));
    };

    const handleMessageDeleted = (data: any) => {
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter(msg => msg.id !== data.messageId)
      }));
    };

    const handleMessageReaction = (data: any) => {
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg => {
          if (msg.id === data.messageId) {
            const reactions = { ...msg.reactions };
            
            if (data.action === 'add') {
              if (!reactions[data.reaction]) {
                reactions[data.reaction] = [];
              }
              if (!reactions[data.reaction].includes(data.userId)) {
                reactions[data.reaction].push(data.userId);
              }
            } else if (data.action === 'remove') {
              if (reactions[data.reaction]) {
                reactions[data.reaction] = reactions[data.reaction].filter(
                  userId => userId !== data.userId
                );
                if (reactions[data.reaction].length === 0) {
                  delete reactions[data.reaction];
                }
              }
            }

            return { ...msg, reactions };
          }
          return msg;
        })
      }));
    };

    // Streaming events
    const handleStreamStart = (data: any) => {
      updateState({
        streamingMessage: {
          id: data.userMessageId || '',
          content: '',
          isComplete: false,
          toolCalls: []
        }
      });
    };

    const handleStreamChunk = (data: any) => {
      setState(prev => {
        if (!prev.streamingMessage) return prev;

        if (data.type === 'content') {
          return {
            ...prev,
            streamingMessage: {
              ...prev.streamingMessage,
              content: prev.streamingMessage.content + data.content
            }
          };
        } else if (data.type === 'tool_call') {
          return {
            ...prev,
            streamingMessage: {
              ...prev.streamingMessage,
              toolCalls: [...prev.streamingMessage.toolCalls, data.toolCall]
            }
          };
        }

        return prev;
      });
    };

    const handleStreamComplete = (data: any) => {
      const message = {
        ...data.message,
        createdAt: new Date(data.message.createdAt),
        updatedAt: new Date(data.message.updatedAt)
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, message].slice(-maxMessages),
        streamingMessage: null
      }));
    };

    const handleStreamError = (data: any) => {
      updateState({
        error: data.error || 'Streaming failed',
        streamingMessage: null
      });
    };

    // Typing events
    const handleTypingStart = (data: any) => {
      setState(prev => ({
        ...prev,
        typingUsers: [...prev.typingUsers.filter(id => id !== data.userId), data.userId]
      }));

      // Auto-remove typing indicator after timeout
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      
      messageTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          typingUsers: prev.typingUsers.filter(id => id !== data.userId)
        }));
      }, 5000);
    };

    const handleTypingStop = (data: any) => {
      setState(prev => ({
        ...prev,
        typingUsers: prev.typingUsers.filter(id => id !== data.userId)
      }));
    };

    // Presence events
    const handleUserJoined = (data: any) => {
      setState(prev => ({
        ...prev,
        participants: [...prev.participants.filter(id => id !== data.userId), data.userId]
      }));
    };

    const handleUserLeft = (data: any) => {
      setState(prev => ({
        ...prev,
        participants: prev.participants.filter(id => id !== data.userId),
        typingUsers: prev.typingUsers.filter(id => id !== data.userId)
      }));
    };

    // Error events
    const handleError = (data: any) => {
      updateState({ error: data.message || 'An error occurred' });
    };

    // Register event listeners
    on('conversation_joined', handleConversationJoined);
    on('conversation_messages', handleConversationMessages);
    on('message_created', handleMessageCreated);
    on('message_updated', handleMessageUpdated);
    on('message_deleted', handleMessageDeleted);
    on('message_reaction', handleMessageReaction);
    on('stream_start', handleStreamStart);
    on('stream_chunk', handleStreamChunk);
    on('stream_complete', handleStreamComplete);
    on('stream_error', handleStreamError);
    on('typing_start', handleTypingStart);
    on('typing_stop', handleTypingStop);
    on('user_joined', handleUserJoined);
    on('user_left', handleUserLeft);
    on('error', handleError);

    // Cleanup
    return () => {
      off('conversation_joined', handleConversationJoined);
      off('conversation_messages', handleConversationMessages);
      off('message_created', handleMessageCreated);
      off('message_updated', handleMessageUpdated);
      off('message_deleted', handleMessageDeleted);
      off('message_reaction', handleMessageReaction);
      off('stream_start', handleStreamStart);
      off('stream_chunk', handleStreamChunk);
      off('stream_complete', handleStreamComplete);
      off('stream_error', handleStreamError);
      off('typing_start', handleTypingStart);
      off('typing_stop', handleTypingStop);
      off('user_joined', handleUserJoined);
      off('user_left', handleUserLeft);
      off('error', handleError);
    };
  }, [socket, on, off, updateState, maxMessages]);

  // Auto-join conversation if specified
  useEffect(() => {
    if (autoJoin && conversationId && isConnected && conversationIdRef.current !== conversationId) {
      joinConversation(conversationId);
    }
  }, [autoJoin, conversationId, isConnected, joinConversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    markAsRead,
    joinConversation,
    leaveConversation,
    loadMessages,
    streamCompletion,
    clearMessages,
    getMessageById,
    isUserTyping
  };
}