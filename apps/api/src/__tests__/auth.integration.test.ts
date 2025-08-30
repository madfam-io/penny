import { FastifyInstance } from 'fastify';\nimport { build } from '../app';\nimport { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Authentication API Integration Tests', () => {
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

  describe('POST /auth/register', () => {
    afterEach(async () => {
      await prisma.user.deleteMany({});
    });

    it('should register new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/register',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
          name: 'New User',
          tenantId: 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('newuser@example.com');
      expect(body.user.name).toBe('New User');
      expect(body.token).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.passwordHash).toBeUndefined(); // Password should not be returned
    });

    it('should hash password correctly', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/register',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'passwordtest@example.com',
          password: 'TestPassword123!',
          name: 'Password Test User',
          tenantId: 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(201);

      // Check that password is hashed in database
      const user = await prisma.user.findUnique({
        where: { email: 'passwordtest@example.com' },
      });
      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).not.toBe('TestPassword123!');

      // Verify password can be checked
      const isValidPassword = await bcrypt.compare('TestPassword123!', user!.passwordHash!);
      expect(isValidPassword).toBe(true);
    });

    it('should reject weak passwords', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/register',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'weakpass@example.com',\n          password: '123',
          name: 'Weak Password User',
          tenantId: 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('password');
    });

    it('should reject duplicate email addresses', async () => {
      // Register first user
      await app.inject({
        method: 'POST',\n        url: '/auth/register',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'duplicate@example.com',
          password: 'Password123!',
          name: 'First User',
          tenantId: 'test-tenant-id',
        },
      });

      // Try to register second user with same email
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/register',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'duplicate@example.com',
          password: 'DifferentPassword123!',
          name: 'Second User',
          tenantId: 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('already exists');
    });

    it('should validate email format', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/register',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'invalid-email',
          password: 'Password123!',
          name: 'Invalid Email User',
          tenantId: 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('email');
    });

    it('should create audit log entry for registration', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/register',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'auditlog@example.com',
          password: 'Password123!',
          name: 'Audit Log User',
          tenantId: 'test-tenant-id',
        },
      });

      expect(response.statusCode).toBe(201);

      // Check audit log entry
      const auditLogs = await prisma.auditLog.findMany({
        where: { action: 'user.register' },
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].metadata).toMatchObject({
        email: 'auditlog@example.com',
      });
    });
  });

  describe('POST /auth/login', () => {
    let testUser: any;

    beforeEach(async () => {
      // Create test user
      const passwordHash = await bcrypt.hash('TestPassword123!', 12);
      testUser = await prisma.user.create({
        data: {
          id: 'test-login-user',
          tenantId: 'test-tenant-id',
          email: 'logintest@example.com',
          name: 'Login Test User',
          passwordHash,
          isActive: true,
        },
      });
    });

    afterEach(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});
    });

    it('should login with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/login',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'logintest@example.com',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('logintest@example.com');
      expect(body.token).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      // Verify JWT token structure
      const decodedToken = jwt.decode(body.token) as any;
      expect(decodedToken.userId).toBe(testUser.id);
      expect(decodedToken.tenantId).toBe('test-tenant-id');
    });

    it('should reject invalid email', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/login',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/login',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'logintest@example.com',
          password: 'WrongPassword123!',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid credentials');
    });

    it('should reject login for inactive user', async () => {
      // Deactivate user
      await prisma.user.update({
        where: { id: testUser.id },
        data: { isActive: false },
      });

      const response = await app.inject({
        method: 'POST',\n        url: '/auth/login',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'logintest@example.com',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Account deactivated');
    });

    it('should update last login timestamp', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/login',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'logintest@example.com',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(200);

      // Check that lastLoginAt was updated
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.lastLoginAt).toBeDefined();
      expect(new Date(updatedUser!.lastLoginAt!).getTime()).toBeGreaterThan(
        new Date(testUser.createdAt).getTime()
      );
    });

    it('should create session record', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/login',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Test User Agent',
          'X-Forwarded-For': '192.168.1.1',
        },
        payload: {
          email: 'logintest@example.com',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(200);

      // Check session record
      const sessions = await prisma.session.findMany({
        where: { userId: testUser.id },
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userAgent).toBe('Test User Agent');\n      expect(sessions[0].ipAddress).toBe('192.168.1.1');
    });

    it('should create audit log for successful login', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/login',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'logintest@example.com',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(200);

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: { 
          action: 'user.login',
          userId: testUser.id,
        },
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].success).toBe(true);
    });

    it('should create audit log for failed login', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/login',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          email: 'logintest@example.com',
          password: 'WrongPassword!',
        },
      });

      expect(response.statusCode).toBe(401);

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: { 
          action: 'user.login_failed',
        },
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].success).toBe(false);
    });
  });

  describe('POST /auth/refresh', () => {
    let testUser: any;
    let refreshToken: string;

    beforeEach(async () => {
      // Create test user and session
      const passwordHash = await bcrypt.hash('TestPassword123!', 12);
      testUser = await prisma.user.create({
        data: {
          id: 'test-refresh-user',
          tenantId: 'test-tenant-id',
          email: 'refreshtest@example.com',
          name: 'Refresh Test User',
          passwordHash,
          isActive: true,
        },
      });

      // Generate refresh token
      refreshToken = jwt.sign(
        { userId: testUser.id, type: 'refresh' },
        process.env.JWT_SECRET!,\n        { expiresIn: '30d' }
      );

      // Create session
      await prisma.session.create({
        data: {
          id: 'test-session-id',
          userId: testUser.id,
          refreshToken: refreshToken,
          userAgent: 'Test Agent',\n          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    });

    afterEach(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.token).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.refreshToken).not.toBe(refreshToken); // Should be a new refresh token
    });

    it('should reject invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          refreshToken: 'invalid-refresh-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject expired refresh token', async () => {
      // Create expired refresh token
      const expiredToken = jwt.sign(
        { userId: testUser.id, type: 'refresh' },
        process.env.JWT_SECRET!,\n        { expiresIn: '-1d' }
      );

      const response = await app.inject({
        method: 'POST',\n        url: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          refreshToken: expiredToken,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    let testUser: any;
    let validToken: string;
    let sessionId: string;

    beforeEach(async () => {
      // Create test user and session
      const passwordHash = await bcrypt.hash('TestPassword123!', 12);
      testUser = await prisma.user.create({
        data: {
          id: 'test-logout-user',
          tenantId: 'test-tenant-id',
          email: 'logouttest@example.com',
          name: 'Logout Test User',
          passwordHash,
          isActive: true,
        },
      });

      // Generate access token
      validToken = jwt.sign(
        { userId: testUser.id, tenantId: testUser.tenantId },
        process.env.JWT_SECRET!,\n        { expiresIn: '1h' }
      );

      // Create session
      const session = await prisma.session.create({
        data: {
          userId: testUser.id,
          refreshToken: 'test-refresh-token',
          userAgent: 'Test Agent',\n          ipAddress: '127.0.0.1',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      sessionId = session.id;
    });

    afterEach(async () => {
      await prisma.session.deleteMany({});
      await prisma.user.deleteMany({});
    });

    it('should logout and invalidate session', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify session is deleted
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });
      expect(session).toBeNull();
    });

    it('should create audit log for logout', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',\n          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: { 
          action: 'user.logout',
          userId: testUser.id,
        },
      });
      expect(auditLogs).toHaveLength(1);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',\n        url: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    let testUser: any;
    let validToken: string;

    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          id: 'test-me-user',
          tenantId: 'test-tenant-id',
          email: 'metest@example.com',
          name: 'Me Test User',
          isActive: true,
        },
      });

      validToken = jwt.sign(
        { userId: testUser.id, tenantId: testUser.tenantId },
        process.env.JWT_SECRET!,\n        { expiresIn: '1h' }
      );
    });

    afterEach(async () => {
      await prisma.user.deleteMany({});
    });

    it('should return current user info', async () => {
      const response = await app.inject({
        method: 'GET',\n        url: '/auth/me',
        headers: {\n          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(testUser.id);
      expect(body.email).toBe('metest@example.com');
      expect(body.name).toBe('Me Test User');
      expect(body.passwordHash).toBeUndefined(); // Should not include password
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',\n        url: '/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});