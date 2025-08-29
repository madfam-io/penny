import { FastifyInstance } from 'fastify';
import { build } from '../app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

describe('Tool Execution Integration Tests', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let validToken: string;
  let testUser: any;

  beforeAll(async () => {
    app = build({ logger: false });
    await app.ready();
    prisma = global.getTestDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-tool-user',
        tenantId: 'test-tenant-id',
        email: 'tooltest@example.com',
        name: 'Tool Test User',
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
  });

  afterEach(async () => {
    await prisma.execution.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('GET /tools', () => {
    it('should list available tools for user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tools',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tools).toBeDefined();
      expect(Array.isArray(body.tools)).toBe(true);
      expect(body.tools.length).toBeGreaterThan(0);

      // Verify tool structure
      const tool = body.tools[0];
      expect(tool).toMatchObject({
        name: expect.any(String),
        displayName: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        schema: expect.any(Object),
        permissions: expect.any(Array),
      });
    });

    it('should filter tools by user permissions', async () => {
      // Create viewer user
      const viewerUser = await prisma.user.create({
        data: {
          id: 'viewer-user',
          tenantId: 'test-tenant-id',
          email: 'viewer@example.com',
          name: 'Viewer User',
          role: 'VIEWER',
          isActive: true,
        },
      });

      const viewerToken = jwt.sign(
        { userId: viewerUser.id, tenantId: viewerUser.tenantId },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const creatorResponse = await app.inject({
        method: 'GET',
        url: '/tools',
        headers: { Authorization: `Bearer ${validToken}` },
      });

      const viewerResponse = await app.inject({
        method: 'GET',
        url: '/tools',
        headers: { Authorization: `Bearer ${viewerToken}` },
      });

      expect(creatorResponse.statusCode).toBe(200);
      expect(viewerResponse.statusCode).toBe(200);

      const creatorTools = JSON.parse(creatorResponse.body).tools;
      const viewerTools = JSON.parse(viewerResponse.body).tools;

      // Creator should have more tools than viewer
      expect(creatorTools.length).toBeGreaterThan(viewerTools.length);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tools',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /tools/:name/execute', () => {
    it('should execute get_company_kpis tool successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_company_kpis/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            period: 'monthly',
            year: 2024,
            month: 1,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.result).toBeDefined();
      expect(body.executionId).toBeDefined();
    });

    it('should execute load_dashboard tool successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/load_dashboard/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            dashboardId: 'executive-dashboard',
            filters: {
              dateRange: '2024-01-01,2024-01-31',
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.result).toBeDefined();
      expect(body.result.widgets).toBeDefined();
    });

    it('should validate tool parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_company_kpis/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            period: 'invalid',
            year: 'not-a-number',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('validation');
    });

    it('should enforce tool permissions', async () => {
      // Create viewer user
      const viewerUser = await prisma.user.create({
        data: {
          id: 'viewer-perm-user',
          tenantId: 'test-tenant-id',
          email: 'viewerperm@example.com',
          name: 'Viewer Perm User',
          role: 'VIEWER',
          isActive: true,
        },
      });

      const viewerToken = jwt.sign(
        { userId: viewerUser.id, tenantId: viewerUser.tenantId },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      // Try to execute a tool that requires CREATOR permissions
      const response = await app.inject({
        method: 'POST',
        url: '/tools/python_code/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${viewerToken}`,
        },
        payload: {
          parameters: {
            code: 'print("Hello World")',
          },
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should handle tool execution errors gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/python_code/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            code: 'raise Exception("Test error")',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.executionId).toBeDefined();
    });

    it('should create execution record', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_company_kpis/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            period: 'monthly',
            year: 2024,
            month: 1,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Check execution record
      const execution = await prisma.execution.findUnique({
        where: { id: body.executionId },
      });

      expect(execution).toBeDefined();
      expect(execution?.userId).toBe(testUser.id);
      expect(execution?.toolName).toBe('get_company_kpis');
      expect(execution?.status).toBe('completed');
      expect(execution?.parameters).toBeDefined();
    });

    it('should create audit log for tool execution', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/get_company_kpis/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            period: 'monthly',
            year: 2024,
            month: 1,
          },
        },
      });

      expect(response.statusCode).toBe(200);

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'tool.execute',
          userId: testUser.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].metadata).toMatchObject({
        toolName: 'get_company_kpis',
      });
    });

    it('should enforce rate limiting', async () => {
      const requests = [];
      
      // Make multiple requests quickly
      for (let i = 0; i < 10; i++) {
        requests.push(
          app.inject({
            method: 'POST',
            url: '/tools/get_company_kpis/execute',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${validToken}`,
            },
            payload: {
              parameters: {
                period: 'monthly',
                year: 2024,
                month: 1,
              },
            },
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Python Code Sandbox Security', () => {
    it('should block malicious file system access', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/python_code/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            code: 'import os\nos.system("rm -rf /")',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('restricted');
    });

    it('should block network access', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/python_code/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            code: `
import urllib.request
urllib.request.urlopen('http://google.com')
            `,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('network access blocked');
    });

    it('should enforce execution timeout', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/python_code/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            code: `
import time
time.sleep(60)  # Should timeout before this completes
            `,
          },
        },
        timeout: 35000, // 35 second timeout for test
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('timeout');
    });

    it('should enforce memory limits', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/python_code/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            code: `
# Try to allocate large amounts of memory
data = []
for i in range(1000000):
    data.append('x' * 1000)
            `,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('memory limit');
    });

    it('should allow safe Python operations', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/python_code/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            code: `
import pandas as pd
import numpy as np

# Create sample data
data = {'A': [1, 2, 3], 'B': [4, 5, 6]}
df = pd.DataFrame(data)
result = df.sum()
print(result)
            `,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.result.output).toContain('A    6');
      expect(body.result.output).toContain('B    15');
    });

    it('should maintain session isolation between executions', async () => {
      // First execution sets a variable
      const response1 = await app.inject({
        method: 'POST',
        url: '/tools/python_code/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            code: 'secret_var = "should_not_persist"',
          },
        },
      });

      expect(response1.statusCode).toBe(200);

      // Second execution tries to access the variable
      const response2 = await app.inject({
        method: 'POST',
        url: '/tools/python_code/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {
            code: 'print(secret_var)',
          },
        },
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.success).toBe(false);
      expect(body2.error).toContain('NameError');
    });
  });

  describe('Tool Registry Management', () => {
    it('should handle non-existent tool', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tools/nonexistent_tool/execute',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          parameters: {},
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should validate tool exists in registry', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tools/get_company_kpis',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('get_company_kpis');
      expect(body.schema).toBeDefined();
    });
  });
});