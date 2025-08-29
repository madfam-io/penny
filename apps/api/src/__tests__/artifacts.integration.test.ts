import { FastifyInstance } from 'fastify';
import { build } from '../app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

describe('Artifacts API Integration Tests', () => {
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
        id: 'test-artifact-user',
        tenantId: 'test-tenant-id',
        email: 'artifacttest@example.com',
        name: 'Artifact Test User',
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
    await prisma.artifact.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('POST /artifacts', () => {
    it('should create chart artifact successfully', async () => {
      const artifactData = {
        type: 'chart',
        title: 'Sales Performance Chart',
        description: 'Monthly sales performance visualization',
        data: {
          type: 'bar',
          labels: ['Jan', 'Feb', 'Mar', 'Apr'],
          datasets: [{
            label: 'Sales ($)',
            data: [12000, 15000, 18000, 22000],
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          }],
        },
        metadata: {
          source: 'Sales Database',
          generatedBy: 'get_company_kpis',
          filters: { period: 'monthly', year: 2024 },
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/artifacts',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: artifactData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      
      expect(body).toMatchObject({
        id: expect.any(String),
        type: 'chart',
        title: 'Sales Performance Chart',
        description: 'Monthly sales performance visualization',
        userId: testUser.id,
        tenantId: testUser.tenantId,
        version: 1,
        status: 'active',
      });

      expect(body.data).toEqual(artifactData.data);
      expect(body.metadata).toEqual(artifactData.metadata);
    });

    it('should create table artifact successfully', async () => {
      const artifactData = {
        type: 'table',
        title: 'KPI Summary Table',
        description: 'Key performance indicators summary',
        data: {
          columns: ['Metric', 'Current', 'Target', 'Variance'],
          rows: [
            ['Revenue', '$125K', '$120K', '+4.2%'],
            ['Users', '2,450', '2,500', '-2.0%'],
            ['Conversion', '3.2%', '3.0%', '+6.7%'],
          ],
        },
        metadata: {
          source: 'Analytics Dashboard',
          refreshedAt: new Date().toISOString(),
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/artifacts',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: artifactData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      
      expect(body.type).toBe('table');
      expect(body.data.columns).toEqual(['Metric', 'Current', 'Target', 'Variance']);
      expect(body.data.rows).toHaveLength(3);
    });

    it('should create code artifact successfully', async () => {
      const artifactData = {
        type: 'code',
        title: 'Data Analysis Script',
        description: 'Python script for sales data analysis',
        data: {
          language: 'python',
          code: `
import pandas as pd
import matplotlib.pyplot as plt

# Load and analyze sales data
df = pd.read_csv('sales_data.csv')
monthly_sales = df.groupby('month')['revenue'].sum()

# Create visualization
plt.figure(figsize=(10, 6))
monthly_sales.plot(kind='bar')
plt.title('Monthly Sales Revenue')
plt.xlabel('Month')
plt.ylabel('Revenue ($)')
plt.show()
          `,
          outputs: [
            {
              type: 'stdout',
              content: 'Script executed successfully',
            },
          ],
        },
        metadata: {
          executedAt: new Date().toISOString(),
          runtime: 'python-3.11',
        },
      };

      const response = await app.inject({
        method: 'POST',
        url: '/artifacts',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: artifactData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      
      expect(body.type).toBe('code');
      expect(body.data.language).toBe('python');
      expect(body.data.code).toContain('import pandas as pd');
    });

    it('should validate artifact data structure', async () => {
      const invalidData = {
        type: 'invalid-type',
        title: 'Invalid Artifact',
        data: null,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/artifacts',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: invalidData,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('validation');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/artifacts',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: {
          type: 'chart',
          title: 'Test Chart',
          data: {},
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create audit log for artifact creation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/artifacts',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          type: 'chart',
          title: 'Audit Test Chart',
          data: { test: 'data' },
        },
      });

      expect(response.statusCode).toBe(201);

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'artifact.create',
          userId: testUser.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].metadata).toMatchObject({
        artifactType: 'chart',
        artifactTitle: 'Audit Test Chart',
      });
    });
  });

  describe('GET /artifacts/:id', () => {
    let testArtifact: any;

    beforeEach(async () => {
      testArtifact = await prisma.artifact.create({
        data: {
          tenantId: testUser.tenantId,
          userId: testUser.id,
          type: 'chart',
          title: 'Test Chart',
          description: 'Test chart description',
          data: {
            type: 'line',
            labels: ['A', 'B', 'C'],
            values: [1, 2, 3],
          },
          metadata: {
            source: 'test',
          },
          version: 1,
          status: 'active',
        },
      });
    });

    it('should retrieve artifact successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/artifacts/${testArtifact.id}`,
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body).toMatchObject({
        id: testArtifact.id,
        type: 'chart',
        title: 'Test Chart',
        description: 'Test chart description',
        version: 1,
        status: 'active',
      });

      expect(body.data).toEqual(testArtifact.data);
    });

    it('should enforce tenant isolation', async () => {
      // Create user from different tenant
      const otherUser = await prisma.user.create({
        data: {
          id: 'other-tenant-user',
          tenantId: 'other-tenant-id',
          email: 'other@example.com',
          name: 'Other User',
          role: 'CREATOR',
          isActive: true,
        },
      });

      const otherToken = jwt.sign(
        { userId: otherUser.id, tenantId: otherUser.tenantId },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const response = await app.inject({
        method: 'GET',
        url: `/artifacts/${testArtifact.id}`,
        headers: {
          Authorization: `Bearer ${otherToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle non-existent artifact', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/artifacts/non-existent-id',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/artifacts/${testArtifact.id}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /artifacts', () => {
    beforeEach(async () => {
      // Create multiple artifacts
      const artifacts = [
        {
          tenantId: testUser.tenantId,
          userId: testUser.id,
          type: 'chart',
          title: 'Chart 1',
          data: { test: 'chart1' },
          version: 1,
          status: 'active',
          createdAt: new Date('2024-01-01'),
        },
        {
          tenantId: testUser.tenantId,
          userId: testUser.id,
          type: 'table',
          title: 'Table 1',
          data: { test: 'table1' },
          version: 1,
          status: 'active',
          createdAt: new Date('2024-01-02'),
        },
        {
          tenantId: testUser.tenantId,
          userId: testUser.id,
          type: 'code',
          title: 'Code 1',
          data: { test: 'code1' },
          version: 1,
          status: 'archived',
          createdAt: new Date('2024-01-03'),
        },
      ];

      await prisma.artifact.createMany({ data: artifacts });
    });

    it('should list artifacts with default pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/artifacts',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.artifacts).toHaveLength(3);
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      });

      // Should be ordered by creation date (newest first)
      expect(body.artifacts[0].title).toBe('Code 1');
      expect(body.artifacts[1].title).toBe('Table 1');
      expect(body.artifacts[2].title).toBe('Chart 1');
    });

    it('should filter by artifact type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/artifacts?type=chart',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.artifacts).toHaveLength(1);
      expect(body.artifacts[0].type).toBe('chart');
    });

    it('should filter by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/artifacts?status=active',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.artifacts).toHaveLength(2);
      body.artifacts.forEach((artifact: any) => {
        expect(artifact.status).toBe('active');
      });
    });

    it('should handle pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/artifacts?page=1&limit=2',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.artifacts).toHaveLength(2);
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('should search artifacts by title', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/artifacts?search=Chart',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body.artifacts).toHaveLength(1);
      expect(body.artifacts[0].title).toBe('Chart 1');
    });

    it('should enforce tenant isolation', async () => {
      // Create artifact for different tenant
      await prisma.artifact.create({
        data: {
          tenantId: 'other-tenant-id',
          userId: 'other-user-id',
          type: 'chart',
          title: 'Other Tenant Chart',
          data: { test: 'other' },
          version: 1,
          status: 'active',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/artifacts',
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should only see artifacts from own tenant
      expect(body.artifacts).toHaveLength(3);
      body.artifacts.forEach((artifact: any) => {
        expect(artifact.tenantId).toBe(testUser.tenantId);
      });
    });
  });

  describe('PUT /artifacts/:id', () => {
    let testArtifact: any;

    beforeEach(async () => {
      testArtifact = await prisma.artifact.create({
        data: {
          tenantId: testUser.tenantId,
          userId: testUser.id,
          type: 'chart',
          title: 'Original Title',
          description: 'Original description',
          data: {
            type: 'bar',
            values: [1, 2, 3],
          },
          version: 1,
          status: 'active',
        },
      });
    });

    it('should update artifact successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated description',
        data: {
          type: 'line',
          values: [4, 5, 6],
          colors: ['red', 'blue', 'green'],
        },
        metadata: {
          updatedReason: 'User requested changes',
        },
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/artifacts/${testArtifact.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body).toMatchObject({
        id: testArtifact.id,
        title: 'Updated Title',
        description: 'Updated description',
        version: 2, // Should increment version
      });

      expect(body.data).toEqual(updateData.data);
      expect(body.metadata).toEqual(updateData.metadata);
    });

    it('should maintain artifact history with versioning', async () => {
      // Update artifact
      await app.inject({
        method: 'PUT',
        url: `/artifacts/${testArtifact.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          title: 'Updated Title',
          data: { type: 'line', values: [4, 5, 6] },
        },
      });

      // Check that artifact version was incremented
      const updatedArtifact = await prisma.artifact.findUnique({
        where: { id: testArtifact.id },
      });

      expect(updatedArtifact?.version).toBe(2);
      expect(updatedArtifact?.title).toBe('Updated Title');
    });

    it('should enforce ownership', async () => {
      // Create different user in same tenant
      const otherUser = await prisma.user.create({
        data: {
          id: 'other-same-tenant-user',
          tenantId: testUser.tenantId,
          email: 'othersame@example.com',
          name: 'Other Same Tenant User',
          role: 'CREATOR',
          isActive: true,
        },
      });

      const otherToken = jwt.sign(
        { userId: otherUser.id, tenantId: otherUser.tenantId },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const response = await app.inject({
        method: 'PUT',
        url: `/artifacts/${testArtifact.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherToken}`,
        },
        payload: {
          title: 'Unauthorized Update',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should create audit log for artifact update', async () => {
      await app.inject({
        method: 'PUT',
        url: `/artifacts/${testArtifact.id}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validToken}`,
        },
        payload: {
          title: 'Audit Update Title',
        },
      });

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'artifact.update',
          userId: testUser.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].metadata).toMatchObject({
        artifactId: testArtifact.id,
        previousVersion: 1,
        newVersion: 2,
      });
    });
  });

  describe('DELETE /artifacts/:id', () => {
    let testArtifact: any;

    beforeEach(async () => {
      testArtifact = await prisma.artifact.create({
        data: {
          tenantId: testUser.tenantId,
          userId: testUser.id,
          type: 'chart',
          title: 'To Be Deleted',
          data: { test: 'delete' },
          version: 1,
          status: 'active',
        },
      });
    });

    it('should soft delete artifact (archive)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/artifacts/${testArtifact.id}`,
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify artifact is archived, not deleted
      const artifact = await prisma.artifact.findUnique({
        where: { id: testArtifact.id },
      });

      expect(artifact).toBeDefined();
      expect(artifact?.status).toBe('archived');
    });

    it('should create audit log for artifact deletion', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/artifacts/${testArtifact.id}`,
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: 'artifact.delete',
          userId: testUser.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].metadata).toMatchObject({
        artifactId: testArtifact.id,
        artifactTitle: 'To Be Deleted',
      });
    });

    it('should enforce ownership for deletion', async () => {
      // Create different user in same tenant
      const otherUser = await prisma.user.create({
        data: {
          id: 'delete-other-user',
          tenantId: testUser.tenantId,
          email: 'deleteother@example.com',
          name: 'Delete Other User',
          role: 'CREATOR',
          isActive: true,
        },
      });

      const otherToken = jwt.sign(
        { userId: otherUser.id, tenantId: otherUser.tenantId },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      const response = await app.inject({
        method: 'DELETE',
        url: `/artifacts/${testArtifact.id}`,
        headers: {
          Authorization: `Bearer ${otherToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Artifact Export', () => {
    let testArtifact: any;

    beforeEach(async () => {
      testArtifact = await prisma.artifact.create({
        data: {
          tenantId: testUser.tenantId,
          userId: testUser.id,
          type: 'chart',
          title: 'Export Test Chart',
          data: {
            type: 'bar',
            labels: ['Q1', 'Q2', 'Q3', 'Q4'],
            values: [100, 150, 120, 180],
          },
          version: 1,
          status: 'active',
        },
      });
    });

    it('should export artifact as JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/artifacts/${testArtifact.id}/export?format=json`,
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      
      const exportedData = JSON.parse(response.body);
      expect(exportedData).toMatchObject({
        id: testArtifact.id,
        type: 'chart',
        title: 'Export Test Chart',
        data: testArtifact.data,
        exportedAt: expect.any(String),
        exportedBy: testUser.id,
      });
    });

    it('should export artifact as CSV for table types', async () => {
      // Create table artifact
      const tableArtifact = await prisma.artifact.create({
        data: {
          tenantId: testUser.tenantId,
          userId: testUser.id,
          type: 'table',
          title: 'Export Test Table',
          data: {
            columns: ['Product', 'Sales', 'Profit'],
            rows: [
              ['Product A', 1000, 250],
              ['Product B', 1500, 400],
              ['Product C', 800, 200],
            ],
          },
          version: 1,
          status: 'active',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/artifacts/${tableArtifact.id}/export?format=csv`,
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      
      const csvContent = response.body;
      expect(csvContent).toContain('Product,Sales,Profit');
      expect(csvContent).toContain('Product A,1000,250');
      expect(csvContent).toContain('Product B,1500,400');
    });
  });
});