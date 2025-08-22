import type { Prisma } from '@prisma/client';
import { prisma } from './client.js';
import { handlePrismaError } from './utils.js';
import type { TenantId } from '@penny/shared';

export interface CreateTenantInput {
  name: string;
  slug: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

export async function createTenant(input: CreateTenantInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          settings: {
            features: {
              enabledModels: ['gpt-3.5-turbo', 'gpt-4'],
              enabledTools: ['get_company_kpis', 'create_jira_ticket'],
              codeExecution: false,
              externalModels: false,
              customPlugins: false,
            },
            limits: {
              maxUsers: 10,
              maxWorkspaces: 5,
              maxConversationsPerDay: 100,
              maxTokensPerDay: 100000,
              maxStorageGB: 10,
            },
          },
        },
      });

      // Create default workspace
      const workspace = await tx.workspace.create({
        data: {
          tenantId: tenant.id,
          name: 'Default',
          isDefault: true,
        },
      });

      // Create admin role if it doesn't exist
      let adminRole = await tx.role.findUnique({
        where: { name: 'admin' },
      });

      if (!adminRole) {
        adminRole = await tx.role.create({
          data: {
            name: 'admin',
            description: 'Administrator with full access',
            permissions: ['*'],
            isSystem: true,
          },
        });
      }

      // Create admin user
      const { CryptoService } = await import('@penny/security');
      const crypto = new CryptoService(
        Buffer.from(process.env.MASTER_ENCRYPTION_KEY || 'change-this-32-byte-key-in-prod!'),
      );
      
      const passwordHash = await crypto.hashPassword(input.adminPassword);

      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.adminEmail,
          name: input.adminName,
          passwordHash,
          isActive: true,
          emailVerified: new Date(),
        },
      });

      // Assign admin role
      await tx.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      });

      // Create default tools
      const defaultTools = [
        {
          name: 'get_company_kpis',
          displayName: 'Get Company KPIs',
          description: 'Retrieve company KPIs for a specific period',
          category: 'analytics',
          schema: {
            type: 'object',
            properties: {
              period: { type: 'string', enum: ['MTD', 'QTD', 'YTD'] },
              unit: { type: 'string', enum: ['company', 'bu', 'project'] },
              id: { type: 'string' },
            },
            required: ['period', 'unit'],
          },
          isSystem: true,
          requiresAuth: false,
          requiresConfirm: false,
        },
        {
          name: 'create_jira_ticket',
          displayName: 'Create Jira Ticket',
          description: 'Create a new Jira ticket',
          category: 'productivity',
          schema: {
            type: 'object',
            properties: {
              projectKey: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              assignee: { type: 'string' },
              labels: { type: 'array', items: { type: 'string' } },
            },
            required: ['projectKey', 'title', 'description'],
          },
          isSystem: true,
          requiresAuth: true,
          requiresConfirm: true,
        },
      ];

      for (const tool of defaultTools) {
        await tx.tool.upsert({
          where: { name: tool.name },
          create: {
            ...tool,
            tenantId: tenant.id,
          },
          update: {},
        });
      }

      return {
        tenant,
        workspace,
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
        },
      };
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

export async function getTenant(idOrSlug: string) {
  try {
    return await prisma.tenant.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

export async function updateTenantSettings(
  tenantId: TenantId,
  settings: Partial<Prisma.JsonValue>,
) {
  try {
    return await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
        },
      },
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

export async function getTenantUsageMetrics(
  tenantId: TenantId,
  startDate?: Date,
  endDate?: Date,
) {
  try {
    const where: Prisma.UsageMetricWhereInput = {
      tenantId,
      timestamp: {
        gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
        lte: endDate || new Date(),
      },
    };

    const metrics = await prisma.usageMetric.groupBy({
      by: ['metric', 'unit'],
      where,
      _sum: {
        value: true,
      },
      _count: true,
    });

    return metrics.map((m) => ({
      metric: m.metric,
      unit: m.unit,
      total: m._sum.value || 0,
      count: m._count,
    }));
  } catch (error) {
    handlePrismaError(error);
  }
}