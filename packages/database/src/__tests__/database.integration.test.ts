import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

describe('Database Integration Tests', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Use test database
    prisma = global.getTestDatabase();
    
    // Reset database to clean state
    await prisma.$executeRaw`TRUNCATE TABLE "User", "Tenant", "Conversation", "Message", "Artifact", "Tool", "Execution", "AuditLog", "Session" RESTART IDENTITY CASCADE;`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Database Schema and Constraints', () => {
    it('should enforce unique email constraint', async () => {
      const tenantId = uuidv4();
      
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'Test Tenant',
          slug: 'test-tenant',
        },
      });

      // Create first user
      await prisma.user.create({
        data: {
          id: uuidv4(),
          tenantId,
          email: 'unique@example.com',
          name: 'First User',
          passwordHash: 'hash1',
        },
      });

      // Try to create second user with same email
      await expect(
        prisma.user.create({
          data: {
            id: uuidv4(),
            tenantId,
            email: 'unique@example.com',
            name: 'Second User',
            passwordHash: 'hash2',
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce foreign key constraints', async () => {
      // Try to create user with non-existent tenant
      await expect(
        prisma.user.create({
          data: {
            id: uuidv4(),
            tenantId: 'non-existent-tenant',
            email: 'fk@example.com',
            name: 'FK Test User',
            passwordHash: 'hash',
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce required fields', async () => {
      await expect(
        prisma.user.create({
          data: {
            id: uuidv4(),
            tenantId: 'some-tenant',
            // Missing required fields: email, name
            passwordHash: 'hash',
          } as any,
        })
      ).rejects.toThrow();
    });

    it('should handle UUID generation correctly', async () => {
      const tenantId = uuidv4();
      
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'UUID Test Tenant',
          slug: 'uuid-test-tenant',
        },
      });

      const user = await prisma.user.create({
        data: {
          tenantId,
          email: 'uuid@example.com',
          name: 'UUID User',
          passwordHash: 'hash',
        },
      });

      expect(user.id).toBeDefined();
      expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Multi-tenant Data Isolation', () => {
    let tenant1Id: string;
    let tenant2Id: string;
    let user1Id: string;
    let user2Id: string;

    beforeEach(async () => {
      // Create two tenants
      tenant1Id = uuidv4();
      tenant2Id = uuidv4();

      await prisma.tenant.createMany({
        data: [
          { id: tenant1Id, name: 'Tenant 1', slug: 'tenant-1' },
          { id: tenant2Id, name: 'Tenant 2', slug: 'tenant-2' },
        ],
      });

      // Create users for each tenant
      const user1 = await prisma.user.create({
        data: {
          tenantId: tenant1Id,
          email: 'user1@example.com',
          name: 'User 1',
          passwordHash: 'hash1',
        },
      });
      user1Id = user1.id;

      const user2 = await prisma.user.create({
        data: {
          tenantId: tenant2Id,
          email: 'user2@example.com',
          name: 'User 2',
          passwordHash: 'hash2',
        },
      });
      user2Id = user2.id;
    });

    afterEach(async () => {
      await prisma.conversation.deleteMany({});
      await prisma.user.deleteMany({});
      await prisma.tenant.deleteMany({});
    });

    it('should maintain tenant isolation for conversations', async () => {
      // Create conversations for each tenant
      const conv1 = await prisma.conversation.create({
        data: {
          tenantId: tenant1Id,
          userId: user1Id,
          title: 'Tenant 1 Conversation',
        },
      });

      const conv2 = await prisma.conversation.create({
        data: {
          tenantId: tenant2Id,
          userId: user2Id,
          title: 'Tenant 2 Conversation',
        },
      });

      // Verify tenant 1 can only see their conversations
      const tenant1Conversations = await prisma.conversation.findMany({
        where: { tenantId: tenant1Id },
      });

      expect(tenant1Conversations).toHaveLength(1);
      expect(tenant1Conversations[0].id).toBe(conv1.id);

      // Verify tenant 2 can only see their conversations
      const tenant2Conversations = await prisma.conversation.findMany({
        where: { tenantId: tenant2Id },
      });

      expect(tenant2Conversations).toHaveLength(1);
      expect(tenant2Conversations[0].id).toBe(conv2.id);
    });

    it('should maintain tenant isolation for messages', async () => {
      // Create conversations
      const conv1 = await prisma.conversation.create({
        data: {
          tenantId: tenant1Id,
          userId: user1Id,
          title: 'Tenant 1 Conversation',
        },
      });

      const conv2 = await prisma.conversation.create({
        data: {
          tenantId: tenant2Id,
          userId: user2Id,
          title: 'Tenant 2 Conversation',
        },
      });

      // Create messages
      await prisma.message.createMany({
        data: [
          {
            conversationId: conv1.id,
            userId: user1Id,
            role: 'user',
            content: 'Tenant 1 message',
          },
          {
            conversationId: conv2.id,
            userId: user2Id,
            role: 'user',
            content: 'Tenant 2 message',
          },
        ],
      });

      // Verify message isolation through conversation join
      const tenant1Messages = await prisma.message.findMany({
        where: {
          conversation: {
            tenantId: tenant1Id,
          },
        },
      });

      const tenant2Messages = await prisma.message.findMany({
        where: {
          conversation: {
            tenantId: tenant2Id,
          },
        },
      });

      expect(tenant1Messages).toHaveLength(1);
      expect(tenant1Messages[0].content).toBe('Tenant 1 message');
      
      expect(tenant2Messages).toHaveLength(1);
      expect(tenant2Messages[0].content).toBe('Tenant 2 message');
    });

    it('should maintain tenant isolation for artifacts', async () => {
      // Create artifacts for each tenant
      await prisma.artifact.createMany({
        data: [
          {
            tenantId: tenant1Id,
            userId: user1Id,
            type: 'chart',
            title: 'Tenant 1 Artifact',
            data: { test: 'data1' },
          },
          {
            tenantId: tenant2Id,
            userId: user2Id,
            type: 'chart',
            title: 'Tenant 2 Artifact',
            data: { test: 'data2' },
          },
        ],
      });

      // Verify artifact isolation
      const tenant1Artifacts = await prisma.artifact.findMany({
        where: { tenantId: tenant1Id },
      });

      const tenant2Artifacts = await prisma.artifact.findMany({
        where: { tenantId: tenant2Id },
      });

      expect(tenant1Artifacts).toHaveLength(1);
      expect(tenant1Artifacts[0].title).toBe('Tenant 1 Artifact');
      
      expect(tenant2Artifacts).toHaveLength(1);
      expect(tenant2Artifacts[0].title).toBe('Tenant 2 Artifact');
    });
  });

  describe('Data Integrity and Cascade Behavior', () => {
    let tenantId: string;
    let userId: string;
    let conversationId: string;

    beforeEach(async () => {
      tenantId = uuidv4();
      
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'Cascade Test Tenant',
          slug: 'cascade-test-tenant',
        },
      });

      const user = await prisma.user.create({
        data: {
          tenantId,
          email: 'cascade@example.com',
          name: 'Cascade User',
          passwordHash: 'hash',
        },
      });
      userId = user.id;

      const conversation = await prisma.conversation.create({
        data: {
          tenantId,
          userId,
          title: 'Cascade Test Conversation',
        },
      });
      conversationId = conversation.id;
    });

    afterEach(async () => {
      await prisma.tenant.deleteMany({});
    });

    it('should cascade delete messages when conversation is deleted', async () => {
      // Create messages
      await prisma.message.createMany({
        data: [
          {
            conversationId,
            userId,
            role: 'user',
            content: 'Message 1',
          },
          {
            conversationId,
            userId,
            role: 'assistant',
            content: 'Message 2',
          },
        ],
      });

      // Verify messages exist
      const messagesBefore = await prisma.message.count({
        where: { conversationId },
      });
      expect(messagesBefore).toBe(2);

      // Delete conversation
      await prisma.conversation.delete({
        where: { id: conversationId },
      });

      // Verify messages are deleted
      const messagesAfter = await prisma.message.count({
        where: { conversationId },
      });
      expect(messagesAfter).toBe(0);
    });

    it('should handle tenant deletion with all related data', async () => {
      // Create additional data
      await prisma.message.create({
        data: {
          conversationId,
          userId,
          role: 'user',
          content: 'Test message',
        },
      });

      await prisma.artifact.create({
        data: {
          tenantId,
          userId,
          type: 'chart',
          title: 'Test Artifact',
          data: { test: 'data' },
        },
      });

      // Delete tenant (should cascade to all related data)
      await prisma.tenant.delete({
        where: { id: tenantId },
      });

      // Verify all related data is deleted
      expect(await prisma.user.count({ where: { tenantId } })).toBe(0);
      expect(await prisma.conversation.count({ where: { tenantId } })).toBe(0);
      expect(await prisma.artifact.count({ where: { tenantId } })).toBe(0);
    });

    it('should maintain referential integrity during concurrent operations', async () => {
      // Run multiple concurrent operations
      const operations = [
        // Create messages
        prisma.message.create({
          data: {
            conversationId,
            userId,
            role: 'user',
            content: 'Concurrent message 1',
          },
        }),
        prisma.message.create({
          data: {
            conversationId,
            userId,
            role: 'user',
            content: 'Concurrent message 2',
          },
        }),
        // Update conversation
        prisma.conversation.update({
          where: { id: conversationId },
          data: { title: 'Updated title' },
        }),
        // Create artifact
        prisma.artifact.create({
          data: {
            tenantId,
            userId,
            type: 'table',
            title: 'Concurrent artifact',
            data: { test: 'concurrent' },
          },
        }),
      ];

      // All operations should succeed
      const results = await Promise.all(operations);
      expect(results).toHaveLength(4);
      expect(results.every(result => result !== null)).toBe(true);
    });
  });

  describe('Performance and Indexing', () => {
    beforeEach(async () => {
      // Create test data for performance tests
      const tenantId = uuidv4();
      
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'Performance Test Tenant',
          slug: 'performance-test-tenant',
        },
      });

      const user = await prisma.user.create({
        data: {
          tenantId,
          email: 'perf@example.com',
          name: 'Performance User',
          passwordHash: 'hash',
        },
      });

      // Create multiple conversations and messages
      for (let i = 0; i < 10; i++) {
        const conversation = await prisma.conversation.create({
          data: {
            tenantId,
            userId: user.id,
            title: `Performance Conversation ${i}`,
          },
        });

        // Create messages for each conversation
        const messageData = [];
        for (let j = 0; j < 20; j++) {
          messageData.push({
            conversationId: conversation.id,
            userId: user.id,
            role: j % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${j} in conversation ${i}`,
          });
        }
        
        await prisma.message.createMany({ data: messageData });
      }
    });

    afterEach(async () => {
      await prisma.tenant.deleteMany({});
    });

    it('should perform tenant-scoped queries efficiently', async () => {
      const startTime = Date.now();
      
      const tenant = await prisma.tenant.findFirst();
      const tenantData = await prisma.tenant.findUnique({
        where: { id: tenant!.id },
        include: {
          users: {
            include: {
              conversations: {
                include: {
                  messages: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                  },
                },
                take: 5,
                orderBy: { updatedAt: 'desc' },
              },
            },
          },
        },
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(tenantData).toBeDefined();
      expect(tenantData?.users.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle pagination efficiently', async () => {
      const tenant = await prisma.tenant.findFirst();
      const user = await prisma.user.findFirst();
      
      const startTime = Date.now();
      
      // Test pagination
      const page1 = await prisma.message.findMany({
        where: {
          conversation: { tenantId: tenant!.id },
        },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });

      const page2 = await prisma.message.findMany({
        where: {
          conversation: { tenantId: tenant!.id },
        },
        take: 10,
        skip: 10,
        orderBy: { createdAt: 'desc' },
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(10);
      expect(page1[0].id).not.toBe(page2[0].id); // Different results
      expect(queryTime).toBeLessThan(500); // Should be fast with proper indexing
    });

    it('should handle search queries efficiently', async () => {
      const tenant = await prisma.tenant.findFirst();
      
      const startTime = Date.now();
      
      // Search across messages
      const searchResults = await prisma.message.findMany({
        where: {
          conversation: { tenantId: tenant!.id },
          content: {
            contains: 'Message',
            mode: 'insensitive',
          },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(searchResults.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Transaction Handling', () => {
    it('should handle successful transactions', async () => {
      const tenantId = uuidv4();
      
      const result = await prisma.$transaction(async (tx) => {
        // Create tenant
        const tenant = await tx.tenant.create({
          data: {
            id: tenantId,
            name: 'Transaction Test Tenant',
            slug: 'transaction-test-tenant',
          },
        });

        // Create user
        const user = await tx.user.create({
          data: {
            tenantId,
            email: 'transaction@example.com',
            name: 'Transaction User',
            passwordHash: 'hash',
          },
        });

        // Create conversation
        const conversation = await tx.conversation.create({
          data: {
            tenantId,
            userId: user.id,
            title: 'Transaction Conversation',
          },
        });

        return { tenant, user, conversation };
      });

      expect(result.tenant).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.conversation).toBeDefined();

      // Verify data was actually committed
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      expect(tenant).toBeDefined();
    });

    it('should rollback failed transactions', async () => {
      const tenantId = uuidv4();
      
      await expect(
        prisma.$transaction(async (tx) => {
          // Create tenant
          await tx.tenant.create({
            data: {
              id: tenantId,
              name: 'Failed Transaction Tenant',
              slug: 'failed-transaction-tenant',
            },
          });

          // Create user
          await tx.user.create({
            data: {
              tenantId,
              email: 'failed@example.com',
              name: 'Failed User',
              passwordHash: 'hash',
            },
          });

          // Intentionally cause an error
          throw new Error('Transaction should rollback');
        })
      ).rejects.toThrow('Transaction should rollback');

      // Verify data was rolled back
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      expect(tenant).toBeNull();
    });
  });

  describe('Database Migrations', () => {
    it('should have all required tables', async () => {
      // Test that all expected tables exist by trying to query them
      const tables = [
        'Tenant',
        'User',
        'Conversation', 
        'Message',
        'Artifact',
        'Tool',
        'Execution',
        'AuditLog',
        'Session',
      ];

      for (const table of tables) {
        // This will throw if table doesn't exist
        await prisma.$queryRaw`SELECT COUNT(*) FROM ${Prisma.raw(`"${table}"`)};`;
      }
    });

    it('should have proper indexes for performance', async () => {
      // Check that key indexes exist
      const indexQueries = [
        // User indexes
        `SELECT indexname FROM pg_indexes WHERE tablename = 'User' AND indexname LIKE '%email%';`,
        `SELECT indexname FROM pg_indexes WHERE tablename = 'User' AND indexname LIKE '%tenantId%';`,
        
        // Message indexes
        `SELECT indexname FROM pg_indexes WHERE tablename = 'Message' AND indexname LIKE '%conversationId%';`,
        
        // Conversation indexes
        `SELECT indexname FROM pg_indexes WHERE tablename = 'Conversation' AND indexname LIKE '%tenantId%';`,
        `SELECT indexname FROM pg_indexes WHERE tablename = 'Conversation' AND indexname LIKE '%userId%';`,
      ];

      for (const query of indexQueries) {
        const result = await prisma.$queryRawUnsafe(query);
        expect(Array.isArray(result)).toBe(true);
        expect((result as any[]).length).toBeGreaterThan(0);
      }
    });
  });
});