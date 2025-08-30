import { FastifyInstance } from 'fastify';
import { build } from '../app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

describe('Admin Dashboard Integration Tests', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let adminToken: string;
  let managerToken: string;
  let userToken: string;
  let testTenant: any;
  let adminUser: any;
  let managerUser: any;
  let regularUser: any;

  beforeAll(async () => {
    app = build({ logger: false });
    await app.ready();
    prisma = global.getTestDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create test tenant
    testTenant = await prisma.tenant.create({
      data: {
        id: 'test-admin-tenant',
        name: 'Test Admin Tenant',
        slug: 'test-admin-tenant',
        settings: {
          features: {
            pythonSandbox: true,
            jiraIntegration: true,
            slackIntegration: false,
          },
          limits: {
            maxUsers: 100,
            maxConversations: 1000,
            maxArtifacts: 500,
          },
        },
      },
    });

    // Create users with different roles
    adminUser = await prisma.user.create({
      data: {
        id: 'admin-user',
        tenantId: testTenant.id,
        email: 'admin@testcompany.com',
        name: 'Admin User',
        role: 'ADMIN',
        isActive: true,
      },
    });

    managerUser = await prisma.user.create({
      data: {
        id: 'manager-user',
        tenantId: testTenant.id,
        email: 'manager@testcompany.com',
        name: 'Manager User',
        role: 'MANAGER',
        isActive: true,
      },
    });

    regularUser = await prisma.user.create({
      data: {
        id: 'regular-user',
        tenantId: testTenant.id,
        email: 'user@testcompany.com',
        name: 'Regular User',
        role: 'CREATOR',
        isActive: true,
      },
    });

    // Generate tokens
    adminToken = jwt.sign(
      { userId: adminUser.id, tenantId: testTenant.id, role: 'ADMIN' },
      process.env.JWT_SECRET!,\n      { expiresIn: '1h' }
    );

    managerToken = jwt.sign(
      { userId: managerUser.id, tenantId: testTenant.id, role: 'MANAGER' },
      process.env.JWT_SECRET!,\n      { expiresIn: '1h' }
    );

    userToken = jwt.sign(
      { userId: regularUser.id, tenantId: testTenant.id, role: 'CREATOR' },
      process.env.JWT_SECRET!,\n      { expiresIn: '1h' }
    );
  });

  afterEach(async () => {
    await prisma.execution.deleteMany({});
    await prisma.artifact.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.tenant.deleteMany({});
  });

  describe('Admin Dashboard Access Control', () => {
    it('should allow admin access to dashboard', async () => {
      const response = await app.inject({
        method: 'GET',\n        url: '/admin/dashboard',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tenantInfo).toBeDefined();
      expect(body.stats).toBeDefined();
    });

    it('should allow manager access to dashboard', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/dashboard',
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should deny regular user access to dashboard', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/dashboard',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/dashboard',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('User Management', () => {
    it('should list users with pagination', async () => {
      const response = await app.inject({
        method: 'GET',\n        url: '/admin/users?page=1&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.users).toBeDefined();
      expect(body.users.length).toBe(3);
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
      });
    });

    it('should filter users by role', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/users?role=ADMIN',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.users).toHaveLength(1);
      expect(body.users[0].role).toBe('ADMIN');
      expect(body.users[0].email).toBe('admin@testcompany.com');
    });

    it('should search users by name or email', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/users?search=manager',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.users).toHaveLength(1);
      expect(body.users[0].name).toBe('Manager User');
    });

    it('should get user details with activity stats', async () => {
      // Create some activity data
      const conversation = await prisma.conversation.create({
        data: {
          tenantId: testTenant.id,
          userId: regularUser.id,
          title: 'Test Conversation',
        },
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId: regularUser.id,
          role: 'user',
          content: 'Test message',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/admin/users/${regularUser.id}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.user).toMatchObject({
        id: regularUser.id,
        email: 'user@testcompany.com',
        name: 'Regular User',
        role: 'CREATOR',
      });

      expect(body.stats).toMatchObject({
        conversationCount: 1,
        messageCount: 1,
        artifactCount: 0,
        lastActivity: expect.any(String),
      });
    });

    it('should update user role', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/admin/users/${regularUser.id}/role`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          role: 'MANAGER',
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify role was updated
      const updatedUser = await prisma.user.findUnique({
        where: { id: regularUser.id },
      });

      expect(updatedUser?.role).toBe('MANAGER');
    });

    it('should deactivate user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/admin/users/${regularUser.id}/status`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify user was deactivated
      const deactivatedUser = await prisma.user.findUnique({
        where: { id: regularUser.id },
      });

      expect(deactivatedUser?.isActive).toBe(false);
    });

    it('should prevent self-deactivation', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/admin/users/${adminUser.id}/status`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('cannot deactivate yourself');
    });

    it('should create audit log for user management actions', async () => {
      await app.inject({
        method: 'PUT',
        url: `/admin/users/${regularUser.id}/role`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          role: 'MANAGER',
        },
      });

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'user.role_changed',
          userId: adminUser.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].metadata).toMatchObject({
        targetUserId: regularUser.id,
        oldRole: 'CREATOR',
        newRole: 'MANAGER',
      });
    });
  });

  describe('Tenant Settings Management', () => {
    it('should get tenant settings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/tenant/settings',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.settings).toMatchObject({
        features: {
          pythonSandbox: true,
          jiraIntegration: true,
          slackIntegration: false,
        },
        limits: {
          maxUsers: 100,
          maxConversations: 1000,
          maxArtifacts: 500,
        },
      });
    });

    it('should update tenant settings', async () => {
      const newSettings = {
        features: {
          pythonSandbox: false,
          jiraIntegration: true,
          slackIntegration: true,
          exportPdf: true,
        },
        limits: {
          maxUsers: 150,
          maxConversations: 2000,
          maxArtifacts: 1000,
        },
        branding: {
          primaryColor: '#007bff',
          logoUrl: 'https://company.com/logo.png',
        },
      };

      const response = await app.inject({
        method: 'PUT',
        url: '/admin/tenant/settings',
        headers: {
          'Content-Type': 'application/json',\n          Authorization: `Bearer ${adminToken}`,
        },
        payload: { settings: newSettings },
      });

      expect(response.statusCode).toBe(200);

      // Verify settings were updated
      const updatedTenant = await prisma.tenant.findUnique({
        where: { id: testTenant.id },
      });

      expect(updatedTenant?.settings).toMatchObject(newSettings);
    });

    it('should restrict settings changes to admins only', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/admin/tenant/settings',
        headers: {
          'Content-Type': 'application/json',\n          Authorization: `Bearer ${managerToken}`,
        },
        payload: {
          settings: {
            features: { pythonSandbox: false },
          },
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should validate settings schema', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/admin/tenant/settings',
        headers: {
          'Content-Type': 'application/json',\n          Authorization: `Bearer ${adminToken}`,
        },
        payload: {
          settings: {
            limits: {
              maxUsers: 'invalid', // Should be number
            },
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('validation');
    });
  });

  describe('Usage Analytics', () => {
    beforeEach(async () => {
      // Create test data for analytics
      const conversation1 = await prisma.conversation.create({
        data: {
          tenantId: testTenant.id,
          userId: regularUser.id,
          title: 'Analytics Test Conversation 1',
        },
      });

      const conversation2 = await prisma.conversation.create({
        data: {
          tenantId: testTenant.id,
          userId: managerUser.id,
          title: 'Analytics Test Conversation 2',
        },
      });

      // Create messages
      await prisma.message.createMany({
        data: [
          {
            conversationId: conversation1.id,
            userId: regularUser.id,
            role: 'user',
            content: 'Test message 1',
            createdAt: new Date('2024-01-15'),
          },
          {
            conversationId: conversation1.id,
            userId: regularUser.id,
            role: 'assistant',
            content: 'Test response 1',\n            createdAt: new Date('2024-01-15'),
          },
          {
            conversationId: conversation2.id,
            userId: managerUser.id,
            role: 'user',
            content: 'Test message 2',\n            createdAt: new Date('2024-01-16'),
          },
        ],
      });

      // Create artifacts
      await prisma.artifact.createMany({
        data: [
          {
            tenantId: testTenant.id,
            userId: regularUser.id,
            type: 'chart',
            title: 'Analytics Chart',
            data: { test: 'data' },\n            createdAt: new Date('2024-01-15'),
          },
          {
            tenantId: testTenant.id,
            userId: managerUser.id,
            type: 'table',
            title: 'Analytics Table',
            data: { test: 'table' },\n            createdAt: new Date('2024-01-16'),
          },
        ],
      });

      // Create executions
      await prisma.execution.createMany({
        data: [
          {
            tenantId: testTenant.id,
            userId: regularUser.id,
            toolName: 'get_company_kpis',
            status: 'completed',
            parameters: { period: 'monthly' },
            result: { kpis: [] },\n            createdAt: new Date('2024-01-15'),
          },
          {
            tenantId: testTenant.id,
            userId: managerUser.id,
            toolName: 'python_code',
            status: 'completed',
            parameters: { code: 'print("hello")' },
            result: { output: 'hello' },\n            createdAt: new Date('2024-01-16'),
          },
        ],
      });
    });

    it('should get overview statistics', async () => {
      const response = await app.inject({
        method: 'GET',\n        url: '/admin/analytics/overview',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.stats).toMatchObject({
        totalUsers: 3,
        activeUsers: 3,
        totalConversations: 2,
        totalMessages: 3,
        totalArtifacts: 2,
        totalExecutions: 2,
      });

      expect(body.trends).toBeDefined();
    });

    it('should get user activity analytics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/analytics/users?period=7d',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.activeUsers).toBeDefined();
      expect(body.userActivity).toBeDefined();
      expect(body.topUsers).toBeDefined();
      expect(Array.isArray(body.topUsers)).toBe(true);
    });

    it('should get tool usage analytics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/analytics/tools?period=30d',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.toolUsage).toBeDefined();
      expect(body.topTools).toBeDefined();
      expect(body.executionStats).toMatchObject({
        total: 2,
        successful: 2,
        failed: 0,
        successRate: 100,
      });
    });

    it('should get artifact creation analytics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/analytics/artifacts?period=30d',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.artifactCreation).toBeDefined();
      expect(body.artifactTypes).toBeDefined();
      expect(body.totalArtifacts).toBe(2);
    });

    it('should handle date range filtering', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/analytics/overview?startDate=2024-01-15&endDate=2024-01-15',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should only include data from Jan 15th
      expect(body.stats.totalMessages).toBe(2); // Only messages from conversation1
      expect(body.stats.totalArtifacts).toBe(1); // Only chart artifact
    });

    it('should export analytics data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/analytics/export?format=csv&type=overview&period=30d',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.body).toContain('Date,Users,Conversations,Messages');
    });
  });

  describe('System Health Monitoring', () => {
    it('should get system health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/health',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.status).toBe('healthy');
      expect(body.checks).toMatchObject({
        database: expect.objectContaining({
          status: 'healthy',
          responseTime: expect.any(Number),
        }),
        redis: expect.objectContaining({
          status: expect.any(String),
        }),
        storage: expect.objectContaining({
          status: expect.any(String),
        }),
      });

      expect(body.metrics).toBeDefined();
    });

    it('should get system metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/metrics',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.performance).toBeDefined();
      expect(body.usage).toBeDefined();
      expect(body.errors).toBeDefined();
    });

    it('should require admin access for health endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/health',
        headers: {
          Authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Audit Trail', () => {
    beforeEach(async () => {
      // Create audit log entries
      await prisma.auditLog.createMany({
        data: [
          {
            tenantId: testTenant.id,
            userId: adminUser.id,
            action: 'user.create',
            resourceType: 'user',
            resourceId: regularUser.id,
            metadata: {
              email: 'user@testcompany.com',
              role: 'CREATOR',
            },
            success: true,
            createdAt: new Date('2024-01-15'),
          },
          {
            tenantId: testTenant.id,
            userId: regularUser.id,
            action: 'artifact.create',
            resourceType: 'artifact',
            resourceId: 'test-artifact-id',
            metadata: {
              artifactType: 'chart',
              title: 'Test Chart',
            },
            success: true,\n            createdAt: new Date('2024-01-16'),
          },
        ],
      });
    });

    it('should get audit logs with pagination', async () => {
      const response = await app.inject({
        method: 'GET',\n        url: '/admin/audit?page=1&limit=10',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.logs).toBeDefined();
      expect(body.logs.length).toBeGreaterThan(0);
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('should filter audit logs by action', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/audit?action=user.create',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.logs).toHaveLength(1);
      expect(body.logs[0].action).toBe('user.create');
    });

    it('should filter audit logs by user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/admin/audit?userId=${regularUser.id}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.logs).toHaveLength(1);
      expect(body.logs[0].userId).toBe(regularUser.id);
      expect(body.logs[0].action).toBe('artifact.create');
    });

    it('should filter audit logs by date range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/audit?startDate=2024-01-15&endDate=2024-01-15',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.logs).toHaveLength(1);
      expect(body.logs[0].action).toBe('user.create');
    });

    it('should export audit logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/audit/export?format=csv',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.body).toContain('Timestamp,User,Action,Resource');
    });

    it('should restrict audit access to admins and managers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/audit',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Billing and Usage Limits', () => {
    it('should get current usage statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/admin/billing/usage',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.usage).toMatchObject({
        users: { current: 3, limit: 100 },
        conversations: { current: expect.any(Number), limit: 1000 },
        artifacts: { current: expect.any(Number), limit: 500 },
        toolExecutions: { current: expect.any(Number) },
      });

      expect(body.billing).toBeDefined();
    });

    it('should check if tenant is approaching limits', async () => {
      // Update tenant limits to be very low
      await prisma.tenant.update({
        where: { id: testTenant.id },
        data: {
          settings: {
            limits: {
              maxUsers: 4, // Close to current usage of 3
              maxConversations: 10,
              maxArtifacts: 5,
            },
          },
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/admin/billing/limits',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.warnings).toBeDefined();
      expect(body.warnings.length).toBeGreaterThan(0);
      expect(body.warnings[0]).toMatchObject({
        type: 'approaching_limit',
        resource: 'users',
        usage: 3,
        limit: 4,
        percentage: 75,
      });
    });
  });
});