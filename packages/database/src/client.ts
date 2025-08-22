import { PrismaClient } from '@prisma/client';
import type { TenantId } from '@penny/shared';
import { prismaConfig } from './config.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaConfig);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Handle connection events and graceful shutdown
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });

  process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

// Middleware for automatic tenant filtering
prisma.$use(async (params, next) => {
  // Check if this is a tenant-scoped model
  const tenantScopedModels = [
    'Tenant',
    'User',
    'Workspace',
    'Conversation',
    'Artifact',
    'Tool',
    'DataSource',
    'ApiKey',
    'AuditLog',
    'UsageMetric',
  ];

  if (params.model && tenantScopedModels.includes(params.model)) {
    // Get tenant from context (this would be set by the request handler)
    const tenantId = (params.args as any)?.__tenantId;
    
    if (tenantId) {
      // Remove the __tenantId from args
      delete (params.args as any).__tenantId;

      // Add tenant filtering for queries
      if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate'].includes(params.action)) {
        params.args = params.args || {};
        params.args.where = params.args.where || {};
        
        if (params.model === 'Tenant') {
          params.args.where.id = tenantId;
        } else {
          params.args.where.tenantId = tenantId;
        }
      }

      // Add tenant ID for creates
      if (params.action === 'create') {
        params.args = params.args || {};
        params.args.data = params.args.data || {};
        
        if (params.model !== 'Tenant') {
          params.args.data.tenantId = tenantId;
        }
      }

      // Add tenant filtering for updates and deletes
      if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
        params.args = params.args || {};
        params.args.where = params.args.where || {};
        
        if (params.model !== 'Tenant') {
          params.args.where.tenantId = tenantId;
        }
      }
    }
  }

  return next(params);
});

// Helper to create a tenant-scoped Prisma client
export function getTenantPrisma(tenantId: TenantId) {
  return new Proxy(prisma, {
    get(target, prop) {
      const value = target[prop as keyof typeof target];
      
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value, {
          get(modelTarget, modelProp) {
            const modelValue = modelTarget[modelProp as keyof typeof modelTarget];
            
            if (typeof modelValue === 'function') {
              return (...args: any[]) => {
                // Add tenant ID to the arguments
                if (args[0] && typeof args[0] === 'object') {
                  args[0].__tenantId = tenantId;
                }
                return modelValue.apply(modelTarget, args);
              };
            }
            
            return modelValue;
          },
        });
      }
      
      return value;
    },
  }) as PrismaClient;
}