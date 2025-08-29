import fastify, { FastifyInstance } from 'fastify';
import { authRoutes } from '../routes/auth';
import { chatRoutes } from '../routes/chat';
import { toolRoutes } from '../routes/tools';
import { artifactRoutes } from '../routes/artifacts';

describe('API Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify({ logger: false });
    
    // Mock authentication
    app.decorate('authenticate', async (request: any, reply: any) => {
      request.user = { id: 'user-123', email: 'test@example.com' };
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Auth Routes', () => {
    beforeEach(async () => {
      await app.register(authRoutes);
    });

    it('should handle login', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('token');
    });

    it('should handle registration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'new@example.com',
          password: 'StrongP@ss123',
          name: 'New User',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toHaveProperty('user');
    });

    it('should handle logout', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/logout',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/refresh',
        payload: {
          refreshToken: 'valid-refresh-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('accessToken');
    });
  });

  describe('Chat Routes', () => {
    beforeEach(async () => {
      await app.register(chatRoutes);
    });

    it('should list conversations', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/conversations',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('conversations');
    });

    it('should create conversation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: {
          authorization: 'Bearer valid-token',
        },
        payload: {
          title: 'New Conversation',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toHaveProperty('id');
    });

    it('should send message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/conversations/conv-123/messages',
        headers: {
          authorization: 'Bearer valid-token',
        },
        payload: {
          content: 'Hello',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('id');
    });

    it('should get conversation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/conversations/conv-123',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('messages');
    });
  });

  describe('Tool Routes', () => {
    beforeEach(async () => {
      await app.register(toolRoutes);
    });

    it('should list tools', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tools',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('tools');
    });

    it('should execute tool', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_company_kpis/invoke',
        headers: {
          authorization: 'Bearer valid-token',
        },
        payload: {
          params: {
            period: 'QTD',
            unit: 'company',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('result');
    });

    it('should get tool schema', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tools/get_company_kpis/schema',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('schema');
    });
  });

  describe('Artifact Routes', () => {
    beforeEach(async () => {
      await app.register(artifactRoutes);
    });

    it('should list artifacts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/artifacts',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('artifacts');
    });

    it('should get artifact', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/artifacts/art-123',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('id');
    });

    it('should create artifact', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/artifacts',
        headers: {
          authorization: 'Bearer valid-token',
        },
        payload: {
          type: 'document',
          name: 'Test Document',
          content: { text: 'Content' },
        },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toHaveProperty('id');
    });

    it('should delete artifact', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/artifacts/art-123',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      expect(response.statusCode).toBe(204);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle missing authentication', async () => {
      await app.register(chatRoutes);
      
      const response = await app.inject({
        method: 'GET',
        url: '/conversations',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should handle validation errors', async () => {
      await app.register(authRoutes);
      
      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'invalid-email',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});