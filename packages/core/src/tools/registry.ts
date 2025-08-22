import type { TenantId, Role } from '@penny/shared';
import { prisma } from '@penny/database';
import { RBACService } from '@penny/security';
import type { ToolDefinition, ToolPermission } from './types.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private rbac: RBACService;

  constructor() {
    this.rbac = new RBACService();
  }

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async listForTenant(tenantId: TenantId): Promise<ToolDefinition[]> {
    // Get tenant settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      return [];
    }

    const settings = tenant.settings as any;
    const enabledTools = settings?.features?.enabledTools || [];

    // Filter tools based on tenant settings
    return this.list().filter(tool => 
      enabledTools.includes(tool.name) || 
      enabledTools.includes('*')
    );
  }

  async listForUser(
    tenantId: TenantId,
    userId: string,
    roles: Role[],
  ): Promise<ToolDefinition[]> {
    // Get tools available for tenant
    const tenantTools = await this.listForTenant(tenantId);

    // Filter based on user permissions
    return tenantTools.filter(tool => {
      const requiredPermissions = tool.config?.permissions || ['tool:execute'];
      
      return requiredPermissions.every(permission => 
        this.rbac.canAccess(
          roles,
          'tool',
          'execute',
          {
            tenantId,
            userId: userId as any,
          },
        )
      );
    });
  }

  async canExecute(
    toolName: string,
    tenantId: TenantId,
    userId: string,
    roles: Role[],
  ): Promise<boolean> {
    const tool = this.get(toolName);
    if (!tool) {
      return false;
    }

    // Check if tool is enabled for tenant
    const tenantTools = await this.listForTenant(tenantId);
    if (!tenantTools.some(t => t.name === toolName)) {
      return false;
    }

    // Check user permissions
    return this.rbac.canAccess(
      roles,
      'tool',
      'execute',
      {
        tenantId,
        userId: userId as any,
      },
    );
  }

  async getToolConfig(
    toolName: string,
    tenantId: TenantId,
  ): Promise<Record<string, any> | null> {
    const dbTool = await prisma.tool.findFirst({
      where: {
        name: toolName,
        OR: [
          { tenantId: null }, // System tools
          { tenantId },       // Tenant-specific tools
        ],
      },
      orderBy: {
        tenantId: 'desc', // Prefer tenant-specific config
      },
    });

    return dbTool?.config as Record<string, any> || null;
  }

  async updateToolConfig(
    toolName: string,
    tenantId: TenantId,
    config: Record<string, any>,
  ): Promise<void> {
    await prisma.tool.upsert({
      where: {
        name: toolName,
      },
      create: {
        name: toolName,
        displayName: this.get(toolName)?.displayName || toolName,
        description: this.get(toolName)?.description || '',
        category: this.get(toolName)?.category || 'utility',
        schema: this.get(toolName)?.schema || {},
        config,
        tenantId,
        isSystem: false,
      },
      update: {
        config,
      },
    });
  }
}