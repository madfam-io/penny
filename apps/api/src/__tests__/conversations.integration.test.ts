import { FastifyInstance } from 'fastify';
import { build } from '../app';
import { PrismaClient } from '@prisma/client';

describe('Conversations API Integration Tests', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = build({ logger: false });
    await app.ready();
    prisma = global.getTestDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /conversations', () => {
    beforeEach(async () => {
      // Create test conversation
      await prisma.conversation.create({
        data: {
          id: 'test-conv-1',
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          title: 'Test Conversation',
          summary: 'A test conversation',
          metadata: { tags: ['test'] },
          isArchived: false,
          messages: {
            create: [
              {
                id: 'test-msg-1',
                tenantId: 'test-tenant-id',
                userId: 'test-user-id',
                role: 'user',
                content: 'Hello, world!',
                metadata: {},
              },
            ],
          },
        },
      });
    });

    afterEach(async () => {
      await prisma.message.deleteMany({});
      await prisma.conversation.deleteMany({});
    });

    it('should return conversations for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/conversations',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        id: 'test-conv-1',
        title: 'Test Conversation',
        isArchived: false,
      });
      expect(body.pagination).toBeDefined();
    });

    it('should filter conversations by archived status', async () => {
      // Create archived conversation
      await prisma.conversation.create({
        data: {
          id: 'test-conv-2',
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          title: 'Archived Conversation',
          isArchived: true,
          archivedAt: new Date(),
          metadata: {},
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/conversations?isArchived=true',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].isArchived).toBe(true);
    });

    it('should search conversations by title', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/conversations?search=Test',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].title).toContain('Test');
    });

    it('should paginate conversations', async () => {
      // Create multiple conversations
      for (let i = 2; i <= 25; i++) {
        await prisma.conversation.create({
          data: {
            id: `test-conv-${i}`,
            tenantId: 'test-tenant-id',
            userId: 'test-user-id',
            title: `Conversation ${i}`,
            metadata: {},
          },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/conversations?limit=10&offset=0',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(10);
      expect(body.pagination.total).toBe(25);
      expect(body.pagination.hasNext).toBe(true);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/conversations',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should enforce tenant isolation', async () => {
      // Create conversation for different tenant
      await prisma.conversation.create({
        data: {
          id: 'other-tenant-conv',
          tenantId: 'other-tenant-id',
          userId: 'other-user-id',
          title: 'Other Tenant Conversation',
          metadata: {},
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/conversations',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].tenantId).toBe('test-tenant-id');
    });
  });

  describe('POST /conversations', () => {
    afterEach(async () => {
      await prisma.conversation.deleteMany({});
    });

    it('should create new conversation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
          'Content-Type': 'application/json',
        },
        payload: {
          title: 'New Conversation',
          metadata: { project: 'Test Project' },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.title).toBe('New Conversation');
      expect(body.metadata.project).toBe('Test Project');
      expect(body.tenantId).toBe('test-tenant-id');
      expect(body.userId).toBe('test-user-id');
    });

    it('should create conversation with default values', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
          'Content-Type': 'application/json',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.title).toBe(null);
      expect(body.metadata).toEqual({});
      expect(body.isArchived).toBe(false);
    });

    it('should validate request payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
          'Content-Type': 'application/json',
        },
        payload: {
          title: 123, // Invalid type
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation Error');
    });
  });

  describe('GET /conversations/:id', () => {
    let conversationId: string;

    beforeEach(async () => {
      const conversation = await prisma.conversation.create({
        data: {
          id: 'test-conv-detail',
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          title: 'Detailed Conversation',
          summary: 'A conversation with messages',
          metadata: { importance: 'high' },
          messages: {
            create: [
              {
                id: 'msg-1',
                tenantId: 'test-tenant-id',
                userId: 'test-user-id',
                role: 'user',
                content: 'First message',
                metadata: {},
              },
              {
                id: 'msg-2',
                tenantId: 'test-tenant-id',
                userId: 'test-user-id',
                role: 'assistant',
                content: 'Assistant response',
                metadata: {},
              },
            ],
          },
        },
      });
      conversationId = conversation.id;
    });

    afterEach(async () => {
      await prisma.message.deleteMany({});
      await prisma.conversation.deleteMany({});
    });

    it('should return conversation with messages', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}`,
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(conversationId);
      expect(body.title).toBe('Detailed Conversation');
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[1].role).toBe('assistant');
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/conversations/non-existent-id',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should enforce tenant isolation for specific conversation', async () => {
      // Try to access conversation from different tenant
      const response = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId}`,
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'other-tenant-id',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /conversations/:id', () => {
    let conversationId: string;

    beforeEach(async () => {
      const conversation = await prisma.conversation.create({
        data: {
          id: 'test-conv-update',
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          title: 'Original Title',
          metadata: { status: 'active' },
        },
      });
      conversationId = conversation.id;
    });

    afterEach(async () => {
      await prisma.conversation.deleteMany({});
    });

    it('should update conversation', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/conversations/${conversationId}`,
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
          'Content-Type': 'application/json',
        },
        payload: {
          title: 'Updated Title',
          metadata: { status: 'completed', priority: 'high' },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.title).toBe('Updated Title');
      expect(body.metadata.status).toBe('completed');
      expect(body.metadata.priority).toBe('high');
    });

    it('should archive conversation', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/conversations/${conversationId}`,
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
          'Content-Type': 'application/json',
        },
        payload: {
          isArchived: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.isArchived).toBe(true);
      expect(body.archivedAt).toBeDefined();
    });
  });

  describe('DELETE /conversations/:id', () => {
    let conversationId: string;

    beforeEach(async () => {
      const conversation = await prisma.conversation.create({
        data: {
          id: 'test-conv-delete',
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          title: 'To be deleted',
          metadata: {},
        },
      });
      conversationId = conversation.id;
    });

    it('should soft delete conversation', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/conversations/${conversationId}`,
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify conversation is soft deleted
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      expect(conversation?.deletedAt).toBeDefined();
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/conversations/non-existent-id',
        headers: {
          Authorization: 'Bearer valid-jwt-token',
          'X-Tenant-ID': 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});