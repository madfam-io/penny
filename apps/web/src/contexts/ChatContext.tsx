import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { useWebSocketContext } from './WebSocketContext';
import { useChat, UseChatReturn } from '../hooks/useChat';
import { usePresence, UsePresenceReturn } from '../hooks/usePresence';
import { useTyping, UseTypingReturn } from '../hooks/useTyping';

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  userName: string;
  content: string;
  type: 'text' | 'system' | 'file' | 'image' | 'stream_start' | 'stream_chunk' | 'stream_end';
  metadata?: Record<string, any>;
  attachments: Attachment[];
  reactions: MessageReaction[];
  mentions: string[];
  replyTo?: string;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isStreaming?: boolean;
  acknowledgments: MessageAcknowledgment[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  emoji: string;
  createdAt: Date;
}

export interface MessageAcknowledgment {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  type: 'delivered' | 'read' | 'acknowledged';
  createdAt: Date;
}

export interface ChatState {
  currentConversationId: string | null;
  conversations: Map<string, ConversationState>;
  activeUsers: Map<string, any>;
  isInitialized: boolean;
}

export interface ConversationState {
  id: string;
  messages: Message[];
  participants: string[];
  typingUsers: any[];
  isLoading: boolean;
  hasMore: boolean;
  lastMessageId?: string;
  unreadCount: number;
  lastReadMessageId?: string;
}

type ChatAction = 
  | { type: 'SET_CURRENT_CONVERSATION'; conversationId: string | null }
  | { type: 'INITIALIZE_CONVERSATION'; conversationId: string; initialData?: Partial<ConversationState> }
  | { type: 'ADD_MESSAGE'; conversationId: string; message: Message }
  | { type: 'UPDATE_MESSAGE'; conversationId: string; messageId: string; updates: Partial<Message> }
  | { type: 'REMOVE_MESSAGE'; conversationId: string; messageId: string }
  | { type: 'SET_MESSAGES'; conversationId: string; messages: Message[]; hasMore: boolean }
  | { type: 'SET_LOADING'; conversationId: string; isLoading: boolean }
  | { type: 'SET_TYPING_USERS'; conversationId: string; users: any[] }
  | { type: 'UPDATE_PARTICIPANTS'; conversationId: string; participants: string[] }
  | { type: 'SET_UNREAD_COUNT'; conversationId: string; count: number }
  | { type: 'MARK_AS_READ'; conversationId: string; messageId: string }
  | { type: 'SET_INITIALIZED'; initialized: boolean }
  | { type: 'RESET_STATE' };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CURRENT_CONVERSATION':
      return {
        ...state,
        currentConversationId: action.conversationId
      };

    case 'INITIALIZE_CONVERSATION':
      if (state.conversations.has(action.conversationId)) {
        return state;
      }
      
      return {
        ...state,
        conversations: new Map(state.conversations).set(action.conversationId, {
          id: action.conversationId,
          messages: [],
          participants: [],
          typingUsers: [],
          isLoading: false,
          hasMore: true,
          unreadCount: 0,
          ...action.initialData
        })
      };

    case 'ADD_MESSAGE':
      const conversations = new Map(state.conversations);
      const conversation = conversations.get(action.conversationId);
      
      if (!conversation) {
        return state;
      }

      const updatedConversation = {
        ...conversation,
        messages: [...conversation.messages, action.message],
        lastMessageId: action.message.id
      };
      
      conversations.set(action.conversationId, updatedConversation);
      
      return {
        ...state,
        conversations
      };

    case 'UPDATE_MESSAGE':
      const conversationsForUpdate = new Map(state.conversations);
      const conversationForUpdate = conversationsForUpdate.get(action.conversationId);
      
      if (!conversationForUpdate) {
        return state;
      }

      const updatedMessages = conversationForUpdate.messages.map(message =>
        message.id === action.messageId ? { ...message, ...action.updates } : message
      );

      conversationsForUpdate.set(action.conversationId, {
        ...conversationForUpdate,
        messages: updatedMessages
      });

      return {
        ...state,
        conversations: conversationsForUpdate
      };

    case 'REMOVE_MESSAGE':
      const conversationsForRemoval = new Map(state.conversations);
      const conversationForRemoval = conversationsForRemoval.get(action.conversationId);
      
      if (!conversationForRemoval) {
        return state;
      }

      const filteredMessages = conversationForRemoval.messages.filter(
        message => message.id !== action.messageId
      );

      conversationsForRemoval.set(action.conversationId, {
        ...conversationForRemoval,
        messages: filteredMessages
      });

      return {
        ...state,
        conversations: conversationsForRemoval
      };

    case 'SET_MESSAGES':
      const conversationsForSet = new Map(state.conversations);
      const conversationForSet = conversationsForSet.get(action.conversationId);
      
      if (!conversationForSet) {
        return state;
      }

      conversationsForSet.set(action.conversationId, {
        ...conversationForSet,
        messages: action.messages,
        hasMore: action.hasMore,
        isLoading: false
      });

      return {
        ...state,
        conversations: conversationsForSet
      };

    case 'SET_LOADING':
      const conversationsForLoading = new Map(state.conversations);
      const conversationForLoading = conversationsForLoading.get(action.conversationId);
      
      if (!conversationForLoading) {
        return state;
      }

      conversationsForLoading.set(action.conversationId, {
        ...conversationForLoading,
        isLoading: action.isLoading
      });

      return {
        ...state,
        conversations: conversationsForLoading
      };

    case 'SET_TYPING_USERS':
      const conversationsForTyping = new Map(state.conversations);
      const conversationForTyping = conversationsForTyping.get(action.conversationId);
      
      if (!conversationForTyping) {
        return state;
      }

      conversationsForTyping.set(action.conversationId, {
        ...conversationForTyping,
        typingUsers: action.users
      });

      return {
        ...state,
        conversations: conversationsForTyping
      };

    case 'UPDATE_PARTICIPANTS':
      const conversationsForParticipants = new Map(state.conversations);
      const conversationForParticipants = conversationsForParticipants.get(action.conversationId);
      
      if (!conversationForParticipants) {
        return state;
      }

      conversationsForParticipants.set(action.conversationId, {
        ...conversationForParticipants,
        participants: action.participants
      });

      return {
        ...state,
        conversations: conversationsForParticipants
      };

    case 'SET_UNREAD_COUNT':
      const conversationsForUnread = new Map(state.conversations);
      const conversationForUnread = conversationsForUnread.get(action.conversationId);
      
      if (!conversationForUnread) {
        return state;
      }

      conversationsForUnread.set(action.conversationId, {
        ...conversationForUnread,
        unreadCount: action.count
      });

      return {
        ...state,
        conversations: conversationsForUnread
      };

    case 'MARK_AS_READ':
      const conversationsForRead = new Map(state.conversations);
      const conversationForRead = conversationsForRead.get(action.conversationId);
      
      if (!conversationForRead) {
        return state;
      }

      conversationsForRead.set(action.conversationId, {
        ...conversationForRead,
        unreadCount: 0,
        lastReadMessageId: action.messageId
      });

      return {
        ...state,
        conversations: conversationsForRead
      };

    case 'SET_INITIALIZED':
      return {
        ...state,
        isInitialized: action.initialized
      };

    case 'RESET_STATE':
      return {
        currentConversationId: null,
        conversations: new Map(),
        activeUsers: new Map(),
        isInitialized: false
      };

    default:
      return state;
  }
}

export interface ChatContextValue {
  // State
  state: ChatState;
  
  // Current conversation
  currentConversation: ConversationState | null;
  
  // Actions
  setCurrentConversation: (conversationId: string | null) => void;
  initializeConversation: (conversationId: string, initialData?: Partial<ConversationState>) => void;
  
  // Chat functionality
  chat: UseChatReturn;
  presence: UsePresenceReturn;
  typing: UseTypingReturn;
  
  // Convenience methods
  sendMessage: (content: string, options?: any) => void;
  loadMessages: (conversationId?: string, options?: any) => void;
  markAsRead: (conversationId?: string, messageId?: string) => void;
  
  // Utilities
  getConversation: (conversationId: string) => ConversationState | undefined;
  getTotalUnreadCount: () => number;
  getActiveConversations: () => ConversationState[];
}

const ChatContext = createContext<ChatContextValue | null>(null);

export interface ChatProviderProps {
  children: ReactNode;
  defaultConversationId?: string;
  enablePresence?: boolean;
  enableTyping?: boolean;
  typingTimeout?: number;
}

export function ChatProvider({
  children,
  defaultConversationId,
  enablePresence = true,
  enableTyping = true,
  typingTimeout = 3000
}: ChatProviderProps) {
  const webSocketContext = useWebSocketContext();
  
  const [state, dispatch] = useReducer(chatReducer, {
    currentConversationId: defaultConversationId || null,
    conversations: new Map(),
    activeUsers: new Map(),
    isInitialized: false
  });

  const chat = useChat({
    conversationId: state.currentConversationId || undefined
  });

  const presence = usePresence({
    enabled: enablePresence
  });

  const typing = useTyping({
    conversationId: state.currentConversationId || undefined,
    typingTimeout
  });

  // Actions
  const setCurrentConversation = useCallback((conversationId: string | null) => {
    dispatch({ type: 'SET_CURRENT_CONVERSATION', conversationId });
  }, []);

  const initializeConversation = useCallback((conversationId: string, initialData?: Partial<ConversationState>) => {
    dispatch({ type: 'INITIALIZE_CONVERSATION', conversationId, initialData });
  }, []);

  const sendMessage = useCallback((content: string, options?: any) => {
    if (state.currentConversationId) {
      chat.sendMessage(content, options);
    }
  }, [state.currentConversationId, chat.sendMessage]);

  const loadMessages = useCallback((conversationId?: string, options?: any) => {
    const targetConversationId = conversationId || state.currentConversationId;
    if (targetConversationId) {
      chat.loadMessages(options);
    }
  }, [state.currentConversationId, chat.loadMessages]);

  const markAsRead = useCallback((conversationId?: string, messageId?: string) => {
    const targetConversationId = conversationId || state.currentConversationId;
    if (targetConversationId) {
      chat.markAsRead(messageId);
      dispatch({ 
        type: 'MARK_AS_READ', 
        conversationId: targetConversationId,
       messageId: messageId || ''
      });
    }
  }, [state.currentConversationId, chat.markAsRead]);

  // Utility methods
  const getConversation = useCallback((conversationId: string) => {
    return state.conversations.get(conversationId);
  }, [state.conversations]);

  const getTotalUnreadCount = useCallback(() => {
    let total = 0;
    for (const conversation of state.conversations.values()) {
      total += conversation.unreadCount;
    }
    return total;
  }, [state.conversations]);

  const getActiveConversations = useCallback(() => {
    return Array.from(state.conversations.values()).filter(
      conversation => conversation.messages.length > 0
    );
  }, [state.conversations]);

  // Sync chat messages with state
  useEffect(() => {
    if (state.currentConversationId && chat.messages.length > 0) {
      dispatch({
        type: 'SET_MESSAGES',
        conversationId: state.currentConversationId,
        messages: chat.messages,
        hasMore: chat.hasMore
      });
    }
  }, [state.currentConversationId, chat.messages, chat.hasMore]);

  // Sync typing users with state
  useEffect(() => {
    if (state.currentConversationId && typing.typingUsers.length >= 0) {
      dispatch({
        type: 'SET_TYPING_USERS',
        conversationId: state.currentConversationId,
        users: typing.typingUsers
      });
    }
  }, [state.currentConversationId, typing.typingUsers]);

  // Initialize conversation when current conversation changes
  useEffect(() => {
    if (state.currentConversationId && !state.conversations.has(state.currentConversationId)) {
      initializeConversation(state.currentConversationId);
    }
  }, [state.currentConversationId, state.conversations, initializeConversation]);

  // Mark as initialized when WebSocket is connected
  useEffect(() => {
    if (webSocketContext.isConnected && !state.isInitialized) {
      dispatch({ type: 'SET_INITIALIZED', initialized: true });
    }
  }, [webSocketContext.isConnected, state.isInitialized]);

  // Reset state on disconnect
  useEffect(() => {
    if (!webSocketContext.isConnected && state.isInitialized) {
      dispatch({ type: 'RESET_STATE' });
    }
  }, [webSocketContext.isConnected, state.isInitialized]);

  const currentConversation = state.currentConversationId 
    ? state.conversations.get(state.currentConversationId) || null 
    : null;

  const contextValue: ChatContextValue = {
    state,
    currentConversation,
    setCurrentConversation,
    initializeConversation,
    chat,
    presence,
    typing,
    sendMessage,
    loadMessages,
    markAsRead,
    getConversation,
    getTotalUnreadCount,
    getActiveConversations
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  
  return context;
}

// Convenience hooks
export function useCurrentConversation() {
  const { currentConversation, state } = useChatContext();
  
  return {
    conversation: currentConversation,
    conversationId: state.currentConversationId,
    messages: currentConversation?.messages || [],
    participants: currentConversation?.participants || [],
    typingUsers: currentConversation?.typingUsers || [],
    isLoading: currentConversation?.isLoading || false,
    unreadCount: currentConversation?.unreadCount || 0
  };
}

export function useChatActions() {
  const { sendMessage, loadMessages, markAsRead, setCurrentConversation } = useChatContext();
  
  return {
    sendMessage,
    loadMessages,
    markAsRead,
    setCurrentConversation
  };
}

export function useChatState() {
  const { state, getTotalUnreadCount, getActiveConversations } = useChatContext();
  
  return {
    ...state,
    totalUnreadCount: getTotalUnreadCount(),
    activeConversations: getActiveConversations()
  };
}