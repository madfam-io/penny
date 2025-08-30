import { PrismaClient } from '@prisma/client';

interface GetTenantsOptions {
  search?: string;
  isActive?: boolean;
  limit: number;
  offset: number;
  sortBy: 'name' | 'slug' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}

interface CreateTenantData {
  name: string;
  slug: string;
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  customCss?: string;
  settings?: Record<string, unknown>;
  features?: Record<string, unknown>;
  limits?: Record<string, unknown>;
}

interface UpdateTenantData {
  name?: string;
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  customCss?: string;
  settings?: Record<string, unknown>;
  features?: Record<string, unknown>;
  limits?: Record<string, unknown>;
}

export class TenantService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getTenants(options: GetTenantsOptions) {
    const { search, isActive, limit, offset, sortBy, sortOrder } = options;

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: {
              users: true,
              workspaces: true,
              conversations: true,
              artifacts: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants.map(tenant => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo: tenant.logo,
        favicon: tenant.favicon,
        primaryColor: tenant.primaryColor,
        customCss: tenant.customCss,
        settings: tenant.settings as Record<string, unknown>,
        features: tenant.features as Record<string, unknown>,
        limits: tenant.limits as Record<string, unknown>,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
        stats: {
          userCount: tenant._count.users,
          workspaceCount: tenant._count.workspaces,
          conversationCount: tenant._count.conversations,
          artifactCount: tenant._count.artifacts,
          monthlyUsage: {}, // Would be populated from usage metrics
        },
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  async getTenant(id: string, options: { includeStats?: boolean } = {}) {
    const { includeStats = false } = options;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        ...(includeStats && {
          _count: {
            select: {
              users: true,
              workspaces: true,
              conversations: true,
              artifacts: true,
            },
          },
        }),
      },
    });

    if (!tenant) {
      return null;
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo: tenant.logo,
      favicon: tenant.favicon,
      primaryColor: tenant.primaryColor,
      customCss: tenant.customCss,
      settings: tenant.settings as Record<string, unknown>,
      features: tenant.features as Record<string, unknown>,
      limits: tenant.limits as Record<string, unknown>,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
      ...(includeStats && {
        stats: {
          userCount: tenant._count?.users || 0,
          workspaceCount: tenant._count?.workspaces || 0,
          conversationCount: tenant._count?.conversations || 0,
          artifactCount: tenant._count?.artifacts || 0,
          monthlyUsage: {}, // Would be populated from usage metrics
        },
      }),
    };
  }

  async createTenant(data: CreateTenantData) {
    // Check if slug is available
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      const error = new Error('Tenant with this slug already exists');
      (error as any).code = 'TENANT_SLUG_EXISTS';
      throw error;
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        favicon: data.favicon,\n        primaryColor: data.primaryColor || '#3b82f6',
        customCss: data.customCss,
        settings: data.settings || {},
        features: data.features || {},
        limits: data.limits || {},
      },
    });

    // Create default workspace
    await this.prisma.workspace.create({
      data: {
        tenantId: tenant.id,
        name: 'Default',
        description: 'Default workspace',
        isDefault: true,
      },
    });

    return this.getTenant(tenant.id);
  }

  async updateTenant(id: string, data: UpdateTenantData) {
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data,
    });

    return this.getTenant(tenant.id);
  }

  async deleteTenant(id: string) {
    try {
      await this.prisma.tenant.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkSlugAvailability(slug: string) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    const available = !existing;
    let suggestions: string[] = [];

    if (!available) {
      // Generate suggestions
      for (let i = 1; i <= 3; i++) {
        const suggestion = `${slug}-${i}`;
        const suggestionExists = await this.prisma.tenant.findUnique({
          where: { slug: suggestion },
        });
        if (!suggestionExists) {
          suggestions.push(suggestion);
        }
      }
    }

    return {
      available,
      ...(suggestions.length > 0 && { suggestions }),
    };
  }

  async getTenantStats(tenantId: string, options: {
    period: '7d' | '30d' | '90d';
    granularity: 'day' | 'week' | 'month';
  }) {
    const { period, granularity } = options;
   
   const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const [tenant, usage, conversations, messages] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          _count: {
            select: {
              users: true,
              workspaces: true,
              conversations: true,
              artifacts: true,
            },
          },
        },
      }),
      this.prisma.usage.groupBy({
        by: ['resourceType'],
        where: {
          tenantId,
          timestamp: { gte: startDate },
        },
        _sum: { quantity: true, cost: true },
      }),
      this.prisma.conversation.count({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.message.aggregate({
        where: {
          conversation: { tenantId },
          createdAt: { gte: startDate },
        },
        _count: true,
        _sum: { tokenCount: true },
      }),
    ]);

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Generate monthly stats (simplified)
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const month = new Date();
      month.setMonth(month.getMonth() - i);
      return {
        month: month.toISOString().substring(0, 7),
        conversations: Math.floor(Math.random() * 100), // Replace with real data
        messages: Math.floor(Math.random() * 1000),
        toolExecutions: Math.floor(Math.random() * 50),
        storageUsed: Math.floor(Math.random() * 1000000),
      };
    }).reverse();

    return {
      userCount: tenant._count.users,
      workspaceCount: tenant._count.workspaces,
      conversationCount: tenant._count.conversations,
      messageCount: messages._count,
      artifactCount: tenant._count.artifacts,
      toolExecutionCount: usage.find(u => u.resourceType === 'tools')?._sum.quantity || 0,
      storageUsed: usage.find(u => u.resourceType === 'storage')?._sum.quantity || 0,
      monthlyStats,
    };
  }

  async getTenantUsage(tenantId: string) {
    // Get tenant limits and current usage
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { limits: true },
      include: {
        subscriptions: {
          where: { status: 'active' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const currentPeriodStart = new Date();
    currentPeriodStart.setDate(1); // Start of current month

    const usage = await this.prisma.usage.groupBy({
      by: ['resourceType'],
      where: {
        tenantId,
        timestamp: { gte: currentPeriodStart },
      },
      _sum: { quantity: true, cost: true },
    });

    const limits = tenant.limits as Record<string, number> || {};
    const current = usage.reduce((acc, u) => {
      acc[u.resourceType] = u._sum.quantity || 0;
      return acc;
    }, {} as Record<string, number>);

    const usageArray = Object.keys(limits).map(metric => ({
      metric,
      limit: limits[metric] || 0,
      current: current[metric] || 0,
      percentage: limits[metric] ? Math.min(100, (current[metric] || 0) / limits[metric] * 100) : 0,
    }));

    const subscription = tenant.subscriptions[0];
    
    return {
      limits,
      current,
      usage: usageArray,
      billing: subscription ? {
        tier: subscription.planId,
        cycleStart: subscription.currentPeriodStart.toISOString(),
        cycleEnd: subscription.currentPeriodEnd.toISOString(),
        nextBillingDate: subscription.currentPeriodEnd.toISOString(),
      } : null,
    };
  }
}