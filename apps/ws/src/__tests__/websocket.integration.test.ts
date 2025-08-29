import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { setupWebSocketHandlers } from '../handlers';

describe('WebSocket Integration Tests', () => {
  let server: any;
  let ioServer: SocketIOServer;
  let prisma: PrismaClient;
  let testUser: any;
  let validToken: string;
  let clientSocket: ClientSocket;

  beforeAll(async () => {
    // Create HTTP server and Socket.IO server
    server = createServer();
    ioServer = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    prisma = global.getTestDatabase();
    setupWebSocketHandlers(ioServer, prisma);

    // Start server
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
  });

  afterAll(async () => {
    server.close();
    ioServer.close();
  });

  beforeEach(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-ws-user',
        tenantId: 'test-tenant-id',
        email: 'wstest@example.com',
        name: 'WebSocket Test User',
        role: 'CREATOR',
        isActive: true,
      },
    });

    // Generate valid token
    validToken = jwt.sign(
      { userId: testUser.id, tenantId: testUser.tenantId },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Create client socket
    const port = server.address().port;
    clientSocket = ioClient(`http://localhost:${port}`, {
      auth: {
        token: validToken,
      },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => resolve());
    });
  });

  afterEach(async () => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('Connection and Authentication', () => {
    it('should connect with valid token', async () => {
      expect(clientSocket.connected).toBe(true);
      expect(clientSocket.id).toBeDefined();
    });

    it('should reject connection with invalid token', async () => {
      const invalidClient = ioClient(`http://localhost:${server.address().port}`, {
        auth: {
          token: 'invalid-token',
        },
        transports: ['websocket'],
      });

      const connectionResult = await new Promise((resolve) => {
        invalidClient.on('connect', () => resolve('connected'));
        invalidClient.on('connect_error', () => resolve('rejected'));
        setTimeout(() => resolve('timeout'), 1000);
      });

      expect(connectionResult).toBe('rejected');
      invalidClient.close();
    });

    it('should join user to tenant room on connection', async () => {
      // Check that user was added to tenant room
      const rooms = ioServer.sockets.adapter.rooms;
      expect(rooms.has(`tenant:${testUser.tenantId}`)).toBe(true);
    });

    it('should track active users', async () => {
      // Emit user status request
      clientSocket.emit('get_active_users');

      const activeUsers = await new Promise((resolve) => {
        clientSocket.on('active_users', resolve);
      });

      expect(activeUsers).toEqual({
        count: 1,
        users: expect.arrayContaining([
          expect.objectContaining({
            id: testUser.id,
            name: testUser.name,
          }),
        ]),
      });
    });
  });

  describe('Real-time Chat', () => {
    let testConversation: any;

    beforeEach(async () => {
      testConversation = await prisma.conversation.create({
        data: {
          id: 'test-conversation',
          tenantId: testUser.tenantId,
          userId: testUser.id,
          title: 'Test Conversation',
        },
      });
    });

    it('should broadcast new messages to conversation participants', async () => {
      const messageContent = 'Hello, this is a test message';
      
      // Listen for incoming messages
      const messagePromise = new Promise((resolve) => {
        clientSocket.on('new_message', resolve);
      });

      // Send message
      clientSocket.emit('send_message', {
        conversationId: testConversation.id,
        content: messageContent,
        type: 'user',
      });

      const receivedMessage = await messagePromise;
      expect(receivedMessage).toMatchObject({
        content: messageContent,
        conversationId: testConversation.id,
        type: 'user',
        userId: testUser.id,
      });
    });

    it('should handle AI assistant streaming responses', async () => {
      const chunks: string[] = [];
      
      // Listen for streaming response
      clientSocket.on('message_chunk', (data: any) => {
        chunks.push(data.chunk);
      });

      const streamComplete = new Promise((resolve) => {
        clientSocket.on('message_complete', resolve);
      });

      // Send message that triggers AI response
      clientSocket.emit('send_message', {
        conversationId: testConversation.id,
        content: 'What are our company KPIs?',
        type: 'user',
      });

      await streamComplete;

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('KPI');
    });

    it('should maintain message order', async () => {
      const messages: any[] = [];
      
      clientSocket.on('new_message', (message) => {
        messages.push(message);
      });

      // Send multiple messages
      const messageContents = ['First message', 'Second message', 'Third message'];
      
      for (const content of messageContents) {
        clientSocket.emit('send_message', {
          conversationId: testConversation.id,
          content,
          type: 'user',
        });
      }

      // Wait for all messages to be received
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('should enforce tenant isolation', async () => {
      // Create user from different tenant
      const otherTenantUser = await prisma.user.create({
        data: {
          id: 'other-tenant-user',
          tenantId: 'other-tenant-id',
          email: 'other@example.com',
          name: 'Other Tenant User',
          role: 'CREATOR',
          isActive: true,
        },
      });

      const otherToken = jwt.sign(
        { userId: otherTenantUser.id, tenantId: otherTenantUser.tenantId },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const otherClient = ioClient(`http://localhost:${server.address().port}`, {
        auth: { token: otherToken },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        otherClient.on('connect', () => resolve());
      });

      let messageReceived = false;
      otherClient.on('new_message', () => {
        messageReceived = true;
      });

      // Send message from first user
      clientSocket.emit('send_message', {
        conversationId: testConversation.id,
        content: 'This should not be seen by other tenant',
        type: 'user',
      });

      // Wait and check that other tenant user didn't receive the message
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(messageReceived).toBe(false);

      otherClient.close();
    });
  });

  describe('Tool Execution Events', () => {
    it('should broadcast tool execution status', async () => {
      const statusUpdates: any[] = [];
      
      clientSocket.on('tool_execution_status', (status) => {
        statusUpdates.push(status);
      });

      // Start tool execution
      clientSocket.emit('execute_tool', {
        name: 'get_company_kpis',
        parameters: {
          period: 'monthly',
          year: 2024,
          month: 1,
        },
      });

      // Wait for status updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(statusUpdates.length).toBeGreaterThan(0);
      expect(statusUpdates[0]).toMatchObject({
        status: 'started',
        toolName: 'get_company_kpis',
      });

      const finalStatus = statusUpdates[statusUpdates.length - 1];
      expect(['completed', 'failed']).toContain(finalStatus.status);
    });

    it('should handle tool execution results', async () => {
      const resultPromise = new Promise((resolve) => {
        clientSocket.on('tool_execution_result', resolve);
      });

      clientSocket.emit('execute_tool', {
        name: 'get_company_kpis',
        parameters: {
          period: 'monthly',
          year: 2024,
          month: 1,
        },
      });

      const result = await resultPromise;
      expect(result).toMatchObject({
        success: true,
        executionId: expect.any(String),
        result: expect.any(Object),
      });
    });

    it('should handle tool execution errors', async () => {
      const errorPromise = new Promise((resolve) => {
        clientSocket.on('tool_execution_error', resolve);
      });

      clientSocket.emit('execute_tool', {
        name: 'python_code',
        parameters: {
          code: 'raise Exception("Test error")',
        },
      });

      const error = await errorPromise;
      expect(error).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('Artifact Updates', () => {
    it('should broadcast artifact creation', async () => {
      const artifactPromise = new Promise((resolve) => {
        clientSocket.on('artifact_created', resolve);
      });

      clientSocket.emit('create_artifact', {
        type: 'chart',
        title: 'Sales Chart',
        data: { labels: ['Q1', 'Q2'], values: [100, 150] },
      });

      const artifact = await artifactPromise;
      expect(artifact).toMatchObject({
        type: 'chart',
        title: 'Sales Chart',
        userId: testUser.id,
        tenantId: testUser.tenantId,
      });
    });

    it('should broadcast artifact updates', async () => {
      // Create artifact first
      const artifact = await prisma.artifact.create({
        data: {
          id: 'test-artifact',
          tenantId: testUser.tenantId,
          userId: testUser.id,
          type: 'chart',
          title: 'Original Chart',
          data: { labels: ['Q1'], values: [100] },
        },
      });

      const updatePromise = new Promise((resolve) => {
        clientSocket.on('artifact_updated', resolve);
      });

      clientSocket.emit('update_artifact', {
        id: artifact.id,
        title: 'Updated Chart',
        data: { labels: ['Q1', 'Q2'], values: [100, 150] },
      });

      const update = await updatePromise;
      expect(update).toMatchObject({
        id: artifact.id,
        title: 'Updated Chart',
      });
    });
  });

  describe('Presence and Typing Indicators', () => {
    it('should handle typing indicators', async () => {
      const typingPromise = new Promise((resolve) => {
        clientSocket.on('user_typing', resolve);
      });

      clientSocket.emit('typing_start', {
        conversationId: 'test-conversation',
      });

      const typingEvent = await typingPromise;
      expect(typingEvent).toMatchObject({
        userId: testUser.id,
        conversationId: 'test-conversation',
        typing: true,
      });
    });

    it('should handle typing stop', async () => {
      const stopTypingPromise = new Promise((resolve) => {
        clientSocket.on('user_typing', resolve);
      });

      clientSocket.emit('typing_stop', {
        conversationId: 'test-conversation',
      });

      const stopTypingEvent = await stopTypingPromise;
      expect(stopTypingEvent).toMatchObject({
        userId: testUser.id,
        conversationId: 'test-conversation',
        typing: false,
      });
    });

    it('should track user presence', async () => {
      // Initially user should be online
      clientSocket.emit('get_presence', { userId: testUser.id });
      
      const presencePromise = new Promise((resolve) => {
        clientSocket.on('user_presence', resolve);
      });

      const presence = await presencePromise;
      expect(presence).toMatchObject({
        userId: testUser.id,
        status: 'online',
        lastSeen: expect.any(String),
      });
    });
  });

  describe('Error Handling and Reconnection', () => {
    it('should handle malformed messages gracefully', async () => {
      let errorReceived = false;
      
      clientSocket.on('error', () => {
        errorReceived = true;
      });

      // Send malformed message
      clientSocket.emit('send_message', 'this is not a valid message object');

      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should not disconnect or crash
      expect(clientSocket.connected).toBe(true);
      expect(errorReceived).toBe(false); // Should handle gracefully without emitting error
    });

    it('should handle permission errors', async () => {
      const errorPromise = new Promise((resolve) => {
        clientSocket.on('permission_error', resolve);
      });

      // Try to send message to conversation user doesn't have access to
      const otherConversation = await prisma.conversation.create({
        data: {
          id: 'other-conversation',
          tenantId: 'other-tenant-id', // Different tenant
          userId: 'other-user-id',
          title: 'Other Conversation',
        },
      });

      clientSocket.emit('send_message', {
        conversationId: otherConversation.id,
        content: 'Unauthorized message',
        type: 'user',
      });

      const error = await errorPromise;
      expect(error).toMatchObject({
        error: 'Permission denied',
        conversationId: otherConversation.id,
      });
    });

    it('should maintain connection state during high load', async () => {
      const messageCount = 50;
      const receivedMessages: any[] = [];
      
      clientSocket.on('new_message', (message) => {
        receivedMessages.push(message);
      });

      // Send many messages rapidly
      for (let i = 0; i < messageCount; i++) {
        clientSocket.emit('send_message', {
          conversationId: testConversation.id,
          content: `Message ${i}`,
          type: 'user',
        });
      }

      // Wait for all messages to be processed
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(clientSocket.connected).toBe(true);
      expect(receivedMessages.length).toBe(messageCount);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit message sending', async () => {
      const messagePromises: Promise<any>[] = [];
      let rateLimitHit = false;

      clientSocket.on('rate_limit_exceeded', () => {
        rateLimitHit = true;
      });

      // Send messages rapidly to trigger rate limiting
      for (let i = 0; i < 100; i++) {
        messagePromises.push(
          new Promise((resolve) => {
            clientSocket.emit('send_message', {
              conversationId: testConversation.id,
              content: `Spam message ${i}`,
              type: 'user',
            });
            setTimeout(resolve, 10);
          })
        );
      }

      await Promise.all(messagePromises);
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(rateLimitHit).toBe(true);
    });
  });
});