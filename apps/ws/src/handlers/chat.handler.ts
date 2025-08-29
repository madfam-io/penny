import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { 
  AuthenticatedSocket, 
  SocketEvent, 
  SendMessageData, 
  SendMessageSchema,
  StreamCompletionData,
  StreamCompletionSchema,
  MessageReactionData,
  MessageReactionSchema
} from '../types';
import { MessageService } from '../services/MessageService';

// Event schemas
const JoinConversationSchema = z.object({
  conversationId: z.string(),
  tenantId: z.string(),
  userId: z.string(),
});

const SendMessageSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1).max(50000),
  role: z.enum(['user', 'assistant', 'system']).default('user'),
  parentMessageId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

const StreamCompletionSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1).max(50000),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32000).optional(),
  toolsEnabled: z.array(z.string()).optional(),
  artifactsEnabled: z.boolean().default(false),
});

const TypingSchema = z.object({
  conversationId: z.string(),
  isTyping: z.boolean(),
});

const MessageReactionSchema = z.object({
  messageId: z.string(),
  reaction: z.string(),
  action: z.enum(['add', 'remove']),
});

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
  };
  conversations?: Set<string>;
}

export class ChatHandler {
  private io: Server;
  private prisma: PrismaClient;
  private aiService: AIService;
  private messageService: MessageService;
  private conversationService: ConversationService;
  private toolService: ToolService;
  private usageService: UsageService;

  // Track active users and typing states
  private activeUsers: Map<string, Set<string>> = new Map(); // conversationId -> Set<userId>
  private typingUsers: Map<string, Map<string, NodeJS.Timeout>> = new Map(); // conversationId -> userId -> timeout
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(io: Server) {
    this.io = io;
    this.prisma = new PrismaClient();
    this.aiService = new AIService();
    this.messageService = new MessageService();
    this.conversationService = new ConversationService();
    this.toolService = new ToolService();
    this.usageService = new UsageService();

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Authentication check
      if (!socket.user) {
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
      }

      this.handleConnection(socket);
      
      // Set up event listeners
      socket.on('join_conversation', (data) => this.handleJoinConversation(socket, data));
      socket.on('leave_conversation', (data) => this.handleLeaveConversation(socket, data));
      socket.on('send_message', (data) => this.handleSendMessage(socket, data));
      socket.on('stream_completion', (data) => this.handleStreamCompletion(socket, data));
      socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
      socket.on('message_reaction', (data) => this.handleMessageReaction(socket, data));
      socket.on('get_conversation_context', (data) => this.handleGetContext(socket, data));
      socket.on('mark_messages_read', (data) => this.handleMarkMessagesRead(socket, data));
      
      socket.on('disconnect', () => this.handleDisconnection(socket));
    });
  }

  private handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.user!.id;
    
    // Track user socket
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    socket.conversations = new Set();

    // Send initial connection confirmation
    socket.emit('connected', {
      socketId: socket.id,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleJoinConversation(socket: AuthenticatedSocket, data: any) {
    try {
      const { conversationId, tenantId, userId } = JoinConversationSchema.parse(data);
      
      // Verify user access to conversation
      const hasAccess = await this.messageService.verifyConversationAccess(
        conversationId,
        { tenantId, userId }
      );

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Join conversation room
      await socket.join(`conversation:${conversationId}`);
      socket.conversations!.add(conversationId);

      // Track active user in conversation
      if (!this.activeUsers.has(conversationId)) {
        this.activeUsers.set(conversationId, new Set());
      }
      this.activeUsers.get(conversationId)!.add(userId);

      // Notify other users in conversation
      socket.to(`conversation:${conversationId}`).emit('user_joined', {
        userId,
        userName: socket.user!.name,
        timestamp: new Date().toISOString(),
      });

      // Send confirmation to user
      socket.emit('joined_conversation', {
        conversationId,
        activeUsers: Array.from(this.activeUsers.get(conversationId)!),
        timestamp: new Date().toISOString(),
      });

      // Get recent messages
      const messages = await this.messageService.getMessages(conversationId, {
        limit: 50,
        offset: 0,
      });

      socket.emit('conversation_messages', {
        conversationId,
        messages: messages.data,
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to join conversation', error: error.message });
    }
  }

  private async handleLeaveConversation(socket: AuthenticatedSocket, data: any) {
    try {
      const { conversationId } = z.object({ conversationId: z.string() }).parse(data);
      
      await this.leaveConversation(socket, conversationId);
      
      socket.emit('left_conversation', {
        conversationId,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to leave conversation', error: error.message });
    }
  }

  private async leaveConversation(socket: AuthenticatedSocket, conversationId: string) {
    const userId = socket.user!.id;

    // Leave room
    await socket.leave(`conversation:${conversationId}`);
    socket.conversations?.delete(conversationId);

    // Remove from active users
    const activeUsers = this.activeUsers.get(conversationId);
    if (activeUsers) {
      activeUsers.delete(userId);
      if (activeUsers.size === 0) {
        this.activeUsers.delete(conversationId);
      }
    }

    // Clear typing state
    this.clearTypingState(conversationId, userId);

    // Notify other users
    socket.to(`conversation:${conversationId}`).emit('user_left', {
      userId,
      userName: socket.user!.name,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: any) {
    try {
      const messageData = SendMessageSchema.parse(data);
      const { tenantId, id: userId } = socket.user!;

      // Verify conversation access
      const hasAccess = await this.messageService.verifyConversationAccess(
        messageData.conversationId,
        { tenantId, userId }
      );

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Create message
      const message = await this.messageService.createMessage({
        ...messageData,
        userId: messageData.role === 'user' ? userId : null,
      });

      // Broadcast to conversation participants
      this.io.to(`conversation:${messageData.conversationId}`).emit('message_created', {
        message,
        timestamp: new Date().toISOString(),
      });

      // Clear typing state for sender
      this.clearTypingState(messageData.conversationId, userId);

      socket.emit('message_sent', {
        messageId: message.id,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to send message', error: error.message });
    }
  }

  private async handleStreamCompletion(socket: AuthenticatedSocket, data: any) {
    try {
      const streamData = StreamCompletionSchema.parse(data);
      const { tenantId, id: userId } = socket.user!;

      // Verify conversation access
      const hasAccess = await this.messageService.verifyConversationAccess(
        streamData.conversationId,
        { tenantId, userId }
      );

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Create user message first
      const userMessage = await this.messageService.createMessage({
        conversationId: streamData.conversationId,
        content: streamData.content,
        role: 'user',
        userId,
      });

      // Broadcast user message
      this.io.to(`conversation:${streamData.conversationId}`).emit('message_created', {
        message: userMessage,
        timestamp: new Date().toISOString(),
      });

      // Start AI completion stream
      const completionStream = await this.messageService.streamCompletion({
        ...streamData,
        tenantId,
        userId,
      });

      let assistantContent = '';
      let toolCalls: any[] = [];

      // Send stream start event
      socket.emit('stream_start', {
        conversationId: streamData.conversationId,
        userMessageId: userMessage.id,
        timestamp: new Date().toISOString(),
      });

      // Process stream chunks
      for await (const chunk of this.parseStreamData(completionStream)) {
        if (chunk.type === 'content') {
          assistantContent += chunk.content;
          
          // Broadcast content chunk to conversation
          this.io.to(`conversation:${streamData.conversationId}`).emit('stream_chunk', {
            type: 'content',
            content: chunk.content,
            timestamp: new Date().toISOString(),
          });

        } else if (chunk.type === 'tool_call') {
          toolCalls.push(chunk.toolCall);
          
          this.io.to(`conversation:${streamData.conversationId}`).emit('stream_chunk', {
            type: 'tool_call',
            toolCall: chunk.toolCall,
            timestamp: new Date().toISOString(),
          });

        } else if (chunk.type === 'tool_execution_start') {
          this.io.to(`conversation:${streamData.conversationId}`).emit('stream_chunk', {
            type: 'tool_execution_start',
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            timestamp: new Date().toISOString(),
          });

        } else if (chunk.type === 'tool_execution_complete') {
          this.io.to(`conversation:${streamData.conversationId}`).emit('stream_chunk', {
            type: 'tool_execution_complete',
            toolCallId: chunk.toolCallId,
            result: chunk.result,
            timestamp: new Date().toISOString(),
          });

        } else if (chunk.type === 'done') {
          // Create final assistant message
          const assistantMessage = await this.messageService.createMessage({
            conversationId: streamData.conversationId,
            content: assistantContent,
            role: 'assistant',
            userId: null,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          });

          // Send completion event
          this.io.to(`conversation:${streamData.conversationId}`).emit('stream_complete', {
            messageId: assistantMessage.id,
            message: assistantMessage,
            timestamp: new Date().toISOString(),
          });

        } else if (chunk.type === 'error') {
          this.io.to(`conversation:${streamData.conversationId}`).emit('stream_error', {
            error: chunk.error,
            timestamp: new Date().toISOString(),
          });
        }
      }

    } catch (error) {
      socket.emit('error', { message: 'Failed to stream completion', error: error.message });
      
      // Send stream error to conversation
      this.io.to(`conversation:${data.conversationId}`).emit('stream_error', {
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async handleTypingStart(socket: AuthenticatedSocket, data: any) {
    try {
      const { conversationId } = TypingSchema.parse({ ...data, isTyping: true });
      const userId = socket.user!.id;

      // Set typing timeout
      if (!this.typingUsers.has(conversationId)) {
        this.typingUsers.set(conversationId, new Map());
      }

      const conversationTyping = this.typingUsers.get(conversationId)!;
      
      // Clear existing timeout
      if (conversationTyping.has(userId)) {
        clearTimeout(conversationTyping.get(userId)!);
      }

      // Set new timeout (auto-stop typing after 5 seconds)
      const timeout = setTimeout(() => {
        this.clearTypingState(conversationId, userId);
        socket.to(`conversation:${conversationId}`).emit('typing_stop', {
          userId,
          userName: socket.user!.name,
          timestamp: new Date().toISOString(),
        });
      }, 5000);

      conversationTyping.set(userId, timeout);

      // Broadcast typing start
      socket.to(`conversation:${conversationId}`).emit('typing_start', {
        userId,
        userName: socket.user!.name,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to handle typing', error: error.message });
    }
  }

  private async handleTypingStop(socket: AuthenticatedSocket, data: any) {
    try {
      const { conversationId } = TypingSchema.parse({ ...data, isTyping: false });
      const userId = socket.user!.id;

      this.clearTypingState(conversationId, userId);

      // Broadcast typing stop
      socket.to(`conversation:${conversationId}`).emit('typing_stop', {
        userId,
        userName: socket.user!.name,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to handle typing stop', error: error.message });
    }
  }

  private async handleMessageReaction(socket: AuthenticatedSocket, data: any) {
    try {
      const reactionData = MessageReactionSchema.parse(data);
      const { tenantId, id: userId } = socket.user!;

      // Verify message access through conversation
      const message = await this.messageService.getMessage(
        reactionData.messageId,
        { tenantId, userId }
      );

      if (!message) {
        socket.emit('error', { message: 'Message not found' });
        return;
      }

      // Update message reactions in metadata
      const currentReactions = message.metadata.reactions || {};
      const userReactions = currentReactions[userId] || [];

      if (reactionData.action === 'add') {
        if (!userReactions.includes(reactionData.reaction)) {
          userReactions.push(reactionData.reaction);
        }
      } else {
        const index = userReactions.indexOf(reactionData.reaction);
        if (index > -1) {
          userReactions.splice(index, 1);
        }
      }

      currentReactions[userId] = userReactions;

      // Update message
      await this.messageService.updateMessage(reactionData.messageId, {
        tenantId,
        userId,
        content: message.content,
        metadata: {
          ...message.metadata,
          reactions: currentReactions,
        },
      });

      // Broadcast reaction update
      this.io.to(`conversation:${message.conversationId}`).emit('message_reaction', {
        messageId: reactionData.messageId,
        userId,
        userName: socket.user!.name,
        reaction: reactionData.reaction,
        action: reactionData.action,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to handle reaction', error: error.message });
    }
  }

  private async handleGetContext(socket: AuthenticatedSocket, data: any) {
    try {
      const { conversationId } = z.object({ conversationId: z.string() }).parse(data);
      const { tenantId, id: userId } = socket.user!;

      const context = await this.conversationService.getConversationContext(
        conversationId,
        { tenantId, userId, maxMessages: 100 }
      );

      if (!context) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      socket.emit('conversation_context', {
        conversationId,
        context,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to get context', error: error.message });
    }
  }

  private async handleMarkMessagesRead(socket: AuthenticatedSocket, data: any) {
    try {
      const { conversationId, messageIds } = z.object({
        conversationId: z.string(),
        messageIds: z.array(z.string()),
      }).parse(data);

      const userId = socket.user!.id;

      // Update read status in user metadata (simplified implementation)
      // In production, you might want a separate read_receipts table
      
      socket.emit('messages_marked_read', {
        conversationId,
        messageIds,
        timestamp: new Date().toISOString(),
      });

      // Broadcast read receipt to other participants
      socket.to(`conversation:${conversationId}`).emit('messages_read', {
        userId,
        userName: socket.user!.name,
        messageIds,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      socket.emit('error', { message: 'Failed to mark messages as read', error: error.message });
    }
  }

  private handleDisconnection(socket: AuthenticatedSocket) {
    const userId = socket.user?.id;
    
    if (!userId) return;

    console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);

    // Remove from user sockets tracking
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    // Leave all conversations
    if (socket.conversations) {
      for (const conversationId of socket.conversations) {
        this.leaveConversation(socket, conversationId).catch(console.error);
      }
    }
  }

  private clearTypingState(conversationId: string, userId: string) {
    const conversationTyping = this.typingUsers.get(conversationId);
    if (conversationTyping?.has(userId)) {
      clearTimeout(conversationTyping.get(userId)!);
      conversationTyping.delete(userId);
      
      if (conversationTyping.size === 0) {
        this.typingUsers.delete(conversationId);
      }
    }
  }

  private async *parseStreamData(stream: any): AsyncGenerator<any> {
    // Parse Server-Sent Events format
    const chunks = stream.toString().split('\n\n');
    
    for (const chunk of chunks) {
      if (chunk.startsWith('data: ')) {
        const data = chunk.substring(6);
        if (data === '[DONE]') {
          yield { type: 'done' };
          break;
        }
        
        try {
          const parsed = JSON.parse(data);
          yield parsed;
        } catch (error) {
          // Skip invalid JSON
        }
      }
    }
  }

  // Public methods for external use
  async broadcastToConversation(conversationId: string, event: string, data: any) {
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  async broadcastToUser(userId: string, event: string, data: any) {
    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds) {
      for (const socketId of userSocketIds) {
        this.io.to(socketId).emit(event, data);
      }
    }
  }

  getActiveUsers(conversationId: string): string[] {
    return Array.from(this.activeUsers.get(conversationId) || []);
  }

  getTypingUsers(conversationId: string): string[] {
    const conversationTyping = this.typingUsers.get(conversationId);
    return conversationTyping ? Array.from(conversationTyping.keys()) : [];
  }

  async shutdown() {
    // Clear all timeouts
    for (const conversationTyping of this.typingUsers.values()) {
      for (const timeout of conversationTyping.values()) {
        clearTimeout(timeout);
      }
    }

    await this.prisma.$disconnect();
  }
}