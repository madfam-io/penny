import { ToolRegistry, ToolExecutor, ToolValidator, BUILTIN_TOOLS } from '@penny/tools';
import { prisma } from '@penny/database';
import { RBACService } from '@penny/security';
import type { TenantId, UserId, Role } from '@penny/shared';
import Redis from 'ioredis';

export interface ToolSearchOptions {
  query?: string;
  category?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'category' | 'rating' | 'usage';
  sortOrder?: 'asc' | 'desc';
  tenantId: TenantId;
  userId: UserId;
  userRoles: Role[];
}

export class ToolRegistryService {
  private registry: ToolRegistry;
  private validator: ToolValidator;
  private rbac: RBACService;
  private redis?: Redis;

  constructor() {
    // Initialize registry with caching and validation
    this.registry = new ToolRegistry({
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      strictValidation: true,
      allowDuplicates: false
    });
    
    this.validator = new ToolValidator({
      strict: true,\n      draft: '2020-12'
    });
    
    this.rbac = new RBACService();
    
    // Initialize Redis if available
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    }

    // Register all built-in tools
    this.initializeBuiltinTools();
  }

  /**
   * Search tools with comprehensive filtering and permissions
   */
  async searchTools(options: ToolSearchOptions) {
    const {
      query,
      category,
      featured,
      limit = 20,
      offset = 0,
      sortBy = 'name',
      sortOrder = 'asc',
      tenantId,
      userId,
      userRoles
    } = options;

    try {
      // Get tools available for user
      const userTools = await this.registry.listForUser(tenantId, userId, userRoles);

      // Apply search and filters
      const searchOptions = {
        query,
        filters: {
          category,
          featured,
        },
        sortBy,
        sortOrder,
        limit,
        offset
      };

      const searchResult = await this.registry.search(searchOptions);

      // Filter by user permissions
      const filteredTools = searchResult.tools.filter(tool => 
        userTools.some(userTool => userTool.name === tool.name)
      );

      // Get additional metadata
      const toolsWithMetadata = await Promise.all(
        filteredTools.map(async (tool) => {
          const analytics = await this.getToolAnalytics(tool.name, tenantId, userId);
          const config = await this.registry.getToolConfig(tool.name, tenantId);
          
          return {
            ...tool,
            analytics: {
              usageCount: analytics.executionCount,
              successRate: analytics.successCount / Math.max(analytics.executionCount, 1),
              avgExecutionTime: analytics.avgExecutionTime
            },
            tenantConfig: config
          };
        })
      );

      return {
        tools: toolsWithMetadata,
        total: filteredTools.length,
        hasMore: offset + limit < filteredTools.length,
        facets: searchResult.facets
      };
    } catch (error) {
      throw new Error(`Failed to search tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific tool by name
   */
  async getTool(name: string, tenantId: TenantId, userId: UserId, userRoles: Role[]) {
    try {
      const tool = this.registry.get(name);
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }

      // Check permissions
      const canExecute = await this.registry.canExecute(name, tenantId, userId, userRoles);
      if (!canExecute) {
        throw new Error(`Insufficient permissions to access tool ${name}`);
      }

      // Get analytics and configuration
      const analytics = await this.getToolAnalytics(name, tenantId, userId);
      const config = await this.registry.getToolConfig(name, tenantId);

      return {
        ...tool,
        analytics,
        tenantConfig: config,
        permissions: {
          canExecute,
          canConfigure: await this.rbac.canAccess(userRoles, 'tool', 'configure', {
            tenantId,
            userId,
            resource: name
          })
        }
      };
    } catch (error) {
      throw new Error(`Failed to get tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get tool analytics
   */
  async getToolAnalytics(toolName: string, tenantId?: TenantId, userId?: UserId) {
    try {
      return await this.registry.getAnalytics(toolName, tenantId, userId);
    } catch (error) {
      // Return default analytics if query fails
      return {
        tool: toolName,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        avgExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        topErrors: [],
        timeline: []
      };
    }
  }

  /**
   * Update tool configuration for a tenant
   */
  async updateToolConfig(
    toolName: string,
    tenantId: TenantId,
    config: Record<string, any>,
    userId: UserId,
    userRoles: Role[]
  ) {
    try {
      // Check permissions
      const canConfigure = await this.rbac.canAccess(userRoles, 'tool', 'configure', {
        tenantId,
        userId,
        resource: toolName
      });

      if (!canConfigure) {
        throw new Error('Insufficient permissions to configure tool');
      }

      await this.registry.updateToolConfig(toolName, tenantId, config);
      
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to update tool config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Install a tool for a tenant
   */
  async installTool(
    toolName: string,
    tenantId: TenantId,
    userId: UserId,
    userRoles: Role[],
    options: { force?: boolean } = {}
  ) {
    try {
      // Check permissions
      const canInstall = await this.rbac.canAccess(userRoles, 'tool', 'install', {
        tenantId,
        userId
      });

      if (!canInstall) {
        throw new Error('Insufficient permissions to install tools');
      }

      // For built-in tools, just enable them in tenant settings
      const tool = this.registry.get(toolName);
      if (tool) {
        await this.enableToolForTenant(toolName, tenantId);
        return { success: true, message: `Tool ${toolName} enabled for tenant` };
      }

      throw new Error(`Tool ${toolName} not found`);
    } catch (error) {
      throw new Error(`Failed to install tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats() {
    return {
      ...this.registry.getStats(),
      validator: this.validator.getStats()
    };
  }

  /**
   * Initialize built-in tools
   */
  private async initializeBuiltinTools() {
    try {
      for (const tool of BUILTIN_TOOLS) {
        await this.registry.register(tool, { validate: true });
      }
      console.log(`Registered ${BUILTIN_TOOLS.length} built-in tools`);
    } catch (error) {
      console.error('Failed to initialize built-in tools:', error);
    }
  }

  /**
   * Enable tool for tenant
   */
  private async enableToolForTenant(toolName: string, tenantId: TenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const settings = (tenant.settings as any) || {};
    const features = settings.features || {};
    const enabledTools = features.enabledTools || [];

    if (!enabledTools.includes(toolName)) {
      enabledTools.push(toolName);
      
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          settings: {
            ...settings,
            features: {
              ...features,
              enabledTools
            }
          }
        }
      });
    }
  }
}

export default ToolRegistryService;