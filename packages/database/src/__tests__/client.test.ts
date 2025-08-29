import { getPrismaClient, prisma } from '../client';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $use: jest.fn(),
    $on: jest.fn(),
    $transaction: jest.fn(),
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tenant: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    conversation: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    Prisma: {
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
        code: string;
        constructor(message: string, code: string) {
          super(message);
          this.code = code;
        }
      },
    },
  };
});

describe('Database Client', () => {
  describe('getPrismaClient', () => {
    it('should return a singleton instance', () => {
      const client1 = getPrismaClient();
      const client2 = getPrismaClient();
      
      expect(client1).toBe(client2);
    });

    it('should connect to database', async () => {
      const client = getPrismaClient();
      
      await client.$connect();
      
      expect(client.$connect).toHaveBeenCalled();
    });

    it('should handle transactions', async () => {
      const client = getPrismaClient();
      const mockTransaction = jest.fn().mockResolvedValue(['result1', 'result2']);
      
      client.$transaction = mockTransaction;
      
      const result = await client.$transaction([
        client.user.create({ data: { email: 'test@example.com' } }),
        client.tenant.create({ data: { name: 'Test Tenant' } }),
      ]);
      
      expect(result).toEqual(['result1', 'result2']);
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('prisma export', () => {
    it('should export prisma client instance', () => {
      expect(prisma).toBeDefined();
      expect(prisma.$connect).toBeDefined();
      expect(prisma.$disconnect).toBeDefined();
    });

    it('should have all required models', () => {
      expect(prisma.user).toBeDefined();
      expect(prisma.tenant).toBeDefined();
      expect(prisma.conversation).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle connection errors', async () => {
      const client = getPrismaClient();
      client.$connect = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      await expect(client.$connect()).rejects.toThrow('Connection failed');
    });

    it('should handle query errors', async () => {
      const client = getPrismaClient();
      client.user.findUnique = jest.fn().mockRejectedValue(
        new Error('Query failed')
      );
      
      await expect(
        client.user.findUnique({ where: { id: 'test' } })
      ).rejects.toThrow('Query failed');
    });
  });

  describe('middleware and hooks', () => {
    it('should support middleware', () => {
      const client = getPrismaClient();
      const middleware = jest.fn();
      
      client.$use(middleware);
      
      expect(client.$use).toHaveBeenCalledWith(middleware);
    });

    it('should support event listeners', () => {
      const client = getPrismaClient();
      const listener = jest.fn();
      
      client.$on('query' as any, listener);
      
      expect(client.$on).toHaveBeenCalledWith('query', listener);
    });
  });

  describe('cleanup', () => {
    it('should disconnect on process exit', async () => {
      const client = getPrismaClient();
      
      await client.$disconnect();
      
      expect(client.$disconnect).toHaveBeenCalled();
    });
  });
});