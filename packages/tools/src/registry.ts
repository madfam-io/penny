import { EventEmitter } from 'events';
import type { TenantId, UserId, Role } from '@penny/shared';
import { prisma } from '@penny/database';
import { RBACService } from '@penny/security';
import { createHash } from 'crypto';
import { isEqual } from 'lodash';
import type {
  ToolDefinition,
  ToolFilter,
  ToolSearchOptions,
  ToolSearchResult,
  ToolRegistryConfig,
  ToolPackage,
  ToolInstallOptions,
  ToolAnalytics,
  ToolEvent,
  ToolEventPayload,
  ToolEventHandler,
  ToolRegistrationError,
  ToolNotFoundError,
  ToolPermissionError
} from './types.js';
import { ToolValidator } from './validator.js';

export class ToolRegistry extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private toolVersions: Map<string, Map<string, ToolDefinition>> = new Map(); // tool -> version -> definition
  private toolsByCategory: Map<string, Set<string>> = new Map();
  private toolsByAuthor: Map<string, Set<string>> = new Map();
  private toolDependencies: Map<string, Set<string>> = new Map(); // tool -> dependencies
  private reverseDependencies: Map<string, Set<string>> = new Map(); // tool -> dependents
  
  private rbac: RBACService;
  private validator: ToolValidator;
  private config: ToolRegistryConfig;
  
  // Caching
  private userToolsCache: Map<string, { tools: ToolDefinition[]; timestamp: number }> = new Map();
  private tenantToolsCache: Map<string, { tools: ToolDefinition[]; timestamp: number }> = new Map();
  private searchCache: Map<string, { result: ToolSearchResult; timestamp: number }> = new Map();
  
  // Analytics
  private registrationCount = 0;
  private lastRegistrationTime?: Date;
  
  // Event handlers
  private eventHandlers: Map<ToolEvent, Set<ToolEventHandler>> = new Map();

  constructor(config: ToolRegistryConfig = {}) {
    super();
    
    this.config = {
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      strictValidation: true,
      allowDuplicates: false,
      signatureValidation: false,
      lazyLoading: false,
      ...config
    };

    this.rbac = new RBACService();
    this.validator = new ToolValidator({
      strict: this.config.strictValidation,
      draft: '2020-12'
    });

    // Set up cache cleanup
    this.setupCacheCleanup();
    
    // Preload tools if configured
    if (this.config.preloadTools?.length) {
      this.preloadTools(this.config.preloadTools);
    }
  }

  /**
   * Register a tool in the registry
   */
  async register(tool: ToolDefinition, options: { force?: boolean; validate?: boolean } = {}): Promise<void> {
    const { force = false, validate = true } = options;

    // Validate tool definition
    if (validate) {
      const validation = this.validator.validateToolDefinition(tool);
      if (!validation.valid) {
        throw new ToolRegistrationError(
          `Tool registration failed: ${validation.errors?.join(', ')}`,
          tool.name || 'unknown',
          'validation_failed'
        );
      }
    }

    // Check for duplicates
    if (!this.config.allowDuplicates && !force && this.tools.has(tool.name)) {
      const existing = this.tools.get(tool.name)!;
      if (existing.version === tool.version) {
        throw new ToolRegistrationError(
          `Tool ${tool.name} version ${tool.version} is already registered`,
          tool.name,
          'duplicate_tool'
        );
      }
    }

    // Generate JSON schema from Zod if not provided
    if (tool.schema && !tool.jsonSchema) {
      tool.jsonSchema = this.validator.zodToJsonSchema(tool.schema, {
        name: `${tool.name}ParametersSchema`
      });
    }

    // Set default version if not provided
    if (!tool.version) {
      tool.version = '1.0.0';
    }

    // Set metadata timestamps
    const now = new Date();
    if (!tool.metadata) tool.metadata = {};
    if (!tool.metadata.createdAt) tool.metadata.createdAt = now;
    tool.metadata.updatedAt = now;

    // Register the tool
    this.tools.set(tool.name, tool);

    // Update version tracking
    if (!this.toolVersions.has(tool.name)) {
      this.toolVersions.set(tool.name, new Map());
    }
    this.toolVersions.get(tool.name)!.set(tool.version, tool);

    // Update category index
    if (!this.toolsByCategory.has(tool.category)) {
      this.toolsByCategory.set(tool.category, new Set());
    }
    this.toolsByCategory.get(tool.category)!.add(tool.name);

    // Update author index
    if (tool.author) {
      if (!this.toolsByAuthor.has(tool.author)) {
        this.toolsByAuthor.set(tool.author, new Set());
      }
      this.toolsByAuthor.get(tool.author)!.add(tool.name);
    }

    // Update dependency tracking
    if (tool.dependencies?.length) {
      const deps = new Set(tool.dependencies.map(dep => dep.name));
      this.toolDependencies.set(tool.name, deps);

      // Update reverse dependencies
      deps.forEach(depName => {
        if (!this.reverseDependencies.has(depName)) {
          this.reverseDependencies.set(depName, new Set());
        }
        this.reverseDependencies.get(depName)!.add(tool.name);
      });
    }

    // Store in database
    await this.persistTool(tool);

    // Clear relevant caches
    this.clearCaches(['user', 'tenant', 'search']);

    // Update analytics
    this.registrationCount++;
    this.lastRegistrationTime = now;

    // Emit event
    this.emitEvent('tool:registered', { tool: tool.name, timestamp: now });

    // Log registration
    console.log(`Registered tool: ${tool.name} v${tool.version} (category: ${tool.category})`);
  }

  /**
   * Unregister a tool from the registry
   */
  async unregister(name: string, options: { cascade?: boolean } = {}): Promise<void> {
    const { cascade = false } = options;

    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }

    // Check for dependencies
    const dependents = this.reverseDependencies.get(name);
    if (dependents?.size && !cascade) {
      throw new ToolRegistrationError(
        `Cannot unregister tool ${name}: it has dependents: ${Array.from(dependents).join(', ')}`,
        name,
        'has_dependents'
      );
    }

    // Unregister dependents if cascade is enabled
    if (cascade && dependents?.size) {
      for (const dependent of dependents) {
        await this.unregister(dependent, { cascade: true });
      }
    }

    // Remove from main registry
    this.tools.delete(name);

    // Remove from version tracking
    this.toolVersions.delete(name);

    // Remove from category index
    if (this.toolsByCategory.has(tool.category)) {
      this.toolsByCategory.get(tool.category)!.delete(name);
      if (this.toolsByCategory.get(tool.category)!.size === 0) {
        this.toolsByCategory.delete(tool.category);
      }
    }

    // Remove from author index
    if (tool.author && this.toolsByAuthor.has(tool.author)) {
      this.toolsByAuthor.get(tool.author)!.delete(name);
      if (this.toolsByAuthor.get(tool.author)!.size === 0) {
        this.toolsByAuthor.delete(tool.author);
      }
    }

    // Clean up dependency tracking
    const deps = this.toolDependencies.get(name);
    if (deps) {
      deps.forEach(depName => {
        this.reverseDependencies.get(depName)?.delete(name);
        if (this.reverseDependencies.get(depName)?.size === 0) {
          this.reverseDependencies.delete(depName);
        }
      });
      this.toolDependencies.delete(name);
    }

    // Remove from database
    await this.removeTool(name);

    // Clear caches
    this.clearCaches(['user', 'tenant', 'search']);

    // Emit event
    this.emitEvent('tool:unregistered', { tool: name, timestamp: new Date() });

    console.log(`Unregistered tool: ${name}`);
  }

  /**
   * Get a tool by name
   */
  get(name: string, version?: string): ToolDefinition | undefined {
    if (version) {
      return this.toolVersions.get(name)?.get(version);
    }
    return this.tools.get(name);
  }

  /**
   * Get all versions of a tool
   */
  getVersions(name: string): ToolDefinition[] {
    const versions = this.toolVersions.get(name);
    if (!versions) return [];
    return Array.from(versions.values());
  }

  /**
   * Get latest version of a tool
   */
  getLatest(name: string): ToolDefinition | undefined {
    const versions = this.getVersions(name);
    if (!versions.length) return undefined;

    // Sort by semantic version (simplified)
    return versions.sort((a, b) => {
      const aVersion = a.version?.split('.').map(Number) || [0, 0, 0];
      const bVersion = b.version?.split('.').map(Number) || [0, 0, 0];
      
      for (let i = 0; i < 3; i++) {
        if (aVersion[i] !== bVersion[i]) {
          return (bVersion[i] || 0) - (aVersion[i] || 0);
        }
      }
      return 0;
    })[0];
  }

  /**
   * List all tools
   */
  list(filter?: ToolFilter): ToolDefinition[] {
    let tools = Array.from(this.tools.values());

    if (!filter) return tools;

    return this.applyFilter(tools, filter);
  }

  /**
   * Search tools with advanced options
   */
  async search(options: ToolSearchOptions): Promise<ToolSearchResult> {
    const cacheKey = JSON.stringify(options);
    
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL!) {
        return cached.result;
      }
    }

    let tools = Array.from(this.tools.values());
    let total = tools.length;

    // Apply text search
    if (options.query) {
      const query = options.query.toLowerCase();
      tools = tools.filter(tool => {
        const searchFields = [
          tool.name,
          tool.displayName,
          tool.description,
          ...(tool.tags || []),
          tool.author || ''
        ].join(' ').toLowerCase();

        if (options.fuzzy) {
          // Simple fuzzy search
          return searchFields.includes(query) || 
                 query.split(' ').some(term => searchFields.includes(term));
        }

        return searchFields.includes(query);
      });
    }

    // Apply filters
    if (options.filters) {
      tools = this.applyFilter(tools, options.filters);
    }

    total = tools.length;

    // Apply sorting
    if (options.sortBy) {
      tools = this.sortTools(tools, options.sortBy, options.sortOrder || 'asc');
    }

    // Apply pagination
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const paginatedTools = tools.slice(offset, offset + limit);

    // Generate facets
    const facets = this.generateFacets(tools);

    const result: ToolSearchResult = {
      tools: paginatedTools,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: offset + limit < total,
      facets
    };

    // Cache result
    if (this.config.cacheEnabled) {
      this.searchCache.set(cacheKey, { result, timestamp: Date.now() });
    }

    return result;
  }

  /**
   * List tools available for a tenant
   */
  async listForTenant(tenantId: TenantId): Promise<ToolDefinition[]> {
    const cacheKey = `tenant:${tenantId}`;
    
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.tenantToolsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL!) {
        return cached.tools;
      }
    }

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
    const disabledTools = settings?.features?.disabledTools || [];

    // Filter tools based on tenant settings
    const tools = this.list().filter(tool => {
      // Check if explicitly disabled
      if (disabledTools.includes(tool.name)) return false;
      
      // Check if explicitly enabled or wildcard enabled
      if (enabledTools.includes(tool.name) || enabledTools.includes('*')) return true;
      
      // Default: allow system tools, check custom tools
      return tool.metadata?.source === 'system' || enabledTools.includes('*');
    });

    // Cache result
    if (this.config.cacheEnabled) {
      this.tenantToolsCache.set(cacheKey, { tools, timestamp: Date.now() });
    }

    return tools;
  }

  /**
   * List tools available for a user
   */
  async listForUser(tenantId: TenantId, userId: UserId, roles: Role[]): Promise<ToolDefinition[]> {
    const cacheKey = `user:${tenantId}:${userId}:${roles.map(r => r.name).sort().join(',')}`;
    
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.userToolsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTTL!) {
        return cached.tools;
      }
    }

    // Get tools available for tenant
    const tenantTools = await this.listForTenant(tenantId);

    // Filter based on user permissions
    const tools = tenantTools.filter(tool => {
      const requiredPermissions = tool.config?.permissions || ['tool:execute'];
      
      return requiredPermissions.every(permission =>
        this.rbac.canAccess(roles, 'tool', 'execute', {
          tenantId,
          userId,
          resource: tool.name
        })
      );
    });

    // Cache result
    if (this.config.cacheEnabled) {
      this.userToolsCache.set(cacheKey, { tools, timestamp: Date.now() });
    }

    return tools;
  }

  /**
   * Check if user can execute a specific tool
   */
  async canExecute(
    toolName: string,
    tenantId: TenantId,
    userId: UserId,
    roles: Role[]
  ): Promise<boolean> {
    const tool = this.get(toolName);
    if (!tool) return false;

    // Check if tool is enabled for tenant
    const tenantTools = await this.listForTenant(tenantId);
    if (!tenantTools.some(t => t.name === toolName)) return false;

    // Check user permissions
    const requiredPermissions = tool.config?.permissions || ['tool:execute'];
    
    return requiredPermissions.every(permission =>
      this.rbac.canAccess(roles, 'tool', 'execute', {
        tenantId,
        userId,
        resource: toolName
      })
    );
  }

  /**
   * Get tool configuration for a tenant
   */
  async getToolConfig(toolName: string, tenantId: TenantId): Promise<Record<string, any> | null> {
    const dbTool = await prisma.tool.findFirst({
      where: {
        name: toolName,
        OR: [
          { tenantId: null }, // System tools
          { tenantId }, // Tenant-specific tools
        ],
      },
      orderBy: {
        tenantId: 'desc', // Prefer tenant-specific config
      },
    });

    return (dbTool?.config as Record<string, any>) || null;
  }

  /**
   * Update tool configuration for a tenant
   */
  async updateToolConfig(
    toolName: string,
    tenantId: TenantId,
    config: Record<string, any>
  ): Promise<void> {
    const tool = this.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    await prisma.tool.upsert({
      where: {
        name_tenantId: {
          name: toolName,
          tenantId: tenantId,
        },
      },
      create: {
        name: toolName,
        displayName: tool.displayName,
        description: tool.description,
        category: tool.category,
        schema: tool.jsonSchema || {},
        config,
        tenantId,
        isSystem: false,
      },
      update: {
        config,
        updatedAt: new Date(),
      },
    });

    // Clear relevant caches
    this.clearCaches(['tenant', 'user']);

    // Emit event
    this.emitEvent('tool:updated', { 
      tool: toolName, 
      timestamp: new Date(),
      tenantId 
    });
  }

  /**
   * Install a tool package
   */
  async installPackage(
    packageInfo: ToolPackage,
    tenantId: TenantId,
    options: ToolInstallOptions = {}
  ): Promise<void> {
    // Validate package
    if (!packageInfo.tools?.length) {
      throw new ToolRegistrationError('Package contains no tools', packageInfo.name, 'empty_package');
    }

    // Check dependencies
    if (options.dependencies !== false && packageInfo.dependencies?.length) {
      for (const dep of packageInfo.dependencies) {
        if (!dep.optional && !this.get(dep.name)) {
          throw new ToolRegistrationError(
            `Missing required dependency: ${dep.name}`,
            packageInfo.name,
            'missing_dependency'
          );
        }
      }
    }

    // Install tools
    for (const tool of packageInfo.tools) {
      // Add package metadata
      tool.metadata = {
        ...tool.metadata,
        package: packageInfo.name,
        packageVersion: packageInfo.version,
        installedAt: new Date()
      };

      await this.register(tool, { force: options.force, validate: true });
    }

    // Store package info
    await prisma.toolPackage.create({
      data: {
        id: packageInfo.id,
        name: packageInfo.name,
        version: packageInfo.version,
        author: packageInfo.author,
        description: packageInfo.description,
        license: packageInfo.license,
        config: packageInfo,
        tenantId,
        installedAt: new Date(),
      },
    });

    console.log(`Installed package: ${packageInfo.name} v${packageInfo.version} with ${packageInfo.tools.length} tools`);
  }

  /**
   * Uninstall a tool package
   */
  async uninstallPackage(packageName: string, tenantId: TenantId): Promise<void> {
    const packageInfo = await prisma.toolPackage.findFirst({
      where: { name: packageName, tenantId },
    });

    if (!packageInfo) {
      throw new ToolNotFoundError(`Package ${packageName} not found`);
    }

    const packageConfig = packageInfo.config as any;
    
    // Uninstall tools
    if (packageConfig.tools) {
      for (const tool of packageConfig.tools) {
        try {
          await this.unregister(tool.name);
        } catch (error) {
          console.warn(`Failed to unregister tool ${tool.name}:`, error);
        }
      }
    }

    // Remove package record
    await prisma.toolPackage.delete({
      where: { id: packageInfo.id },
    });

    console.log(`Uninstalled package: ${packageName}`);
  }

  /**
   * Get tool analytics
   */
  async getAnalytics(toolName: string, tenantId?: TenantId, userId?: UserId): Promise<ToolAnalytics> {
    const tool = this.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }

    // Query execution statistics
    const where: any = { toolName };
    if (tenantId) where.tenantId = tenantId;
    if (userId) where.userId = userId;

    const executions = await prisma.toolExecution.findMany({
      where,
      select: {
        status: true,
        duration: true,
        createdAt: true,
        error: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit for performance
    });

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;

    // Calculate performance metrics
    const durations = executions
      .filter(e => e.duration)
      .map(e => e.duration!);

    const avgExecutionTime = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    const minExecutionTime = durations.length > 0 ? Math.min(...durations) : 0;
    const maxExecutionTime = durations.length > 0 ? Math.max(...durations) : 0;

    // Analyze errors
    const errorCounts: Record<string, number> = {};
    executions
      .filter(e => e.error)
      .forEach(e => {
        try {
          const error = typeof e.error === 'string' ? JSON.parse(e.error) : e.error;
          const code = error?.code || 'unknown';
          errorCounts[code] = (errorCounts[code] || 0) + 1;
        } catch {
          errorCounts['unknown'] = (errorCounts['unknown'] || 0) + 1;
        }
      });

    const topErrors = Object.entries(errorCounts)
      .map(([code, count]) => ({
        code,
        count,
        percentage: totalExecutions > 0 ? (count / totalExecutions) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate timeline data (daily aggregates)
    const timeline = this.generateTimeline(executions);

    return {
      tool: toolName,
      tenant: tenantId,
      user: userId,
      executionCount: totalExecutions,
      successCount: successfulExecutions,
      failureCount: failedExecutions,
      avgExecutionTime,
      minExecutionTime,
      maxExecutionTime,
      topErrors,
      timeline
    };
  }

  /**
   * Add event handler
   */
  onEvent(event: ToolEvent, handler: ToolEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event handler
   */
  offEvent(event: ToolEvent, handler: ToolEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    toolsByCategory: Record<string, number>;
    toolsByAuthor: Record<string, number>;
    registrationCount: number;
    lastRegistrationTime?: Date;
    cacheStats: {
      userCache: number;
      tenantCache: number;
      searchCache: number;
    };
  } {
    const toolsByCategory: Record<string, number> = {};
    this.toolsByCategory.forEach((tools, category) => {
      toolsByCategory[category] = tools.size;
    });

    const toolsByAuthor: Record<string, number> = {};
    this.toolsByAuthor.forEach((tools, author) => {
      toolsByAuthor[author] = tools.size;
    });

    return {
      totalTools: this.tools.size,
      toolsByCategory,
      toolsByAuthor,
      registrationCount: this.registrationCount,
      lastRegistrationTime: this.lastRegistrationTime,
      cacheStats: {
        userCache: this.userToolsCache.size,
        tenantCache: this.tenantToolsCache.size,
        searchCache: this.searchCache.size,
      },
    };
  }

  // Private helper methods

  private applyFilter(tools: ToolDefinition[], filter: ToolFilter): ToolDefinition[] {
    return tools.filter(tool => {
      // Category filter
      if (filter.category) {
        const categories = Array.isArray(filter.category) ? filter.category : [filter.category];
        if (!categories.includes(tool.category)) return false;
      }

      // Tags filter
      if (filter.tags) {
        const requiredTags = Array.isArray(filter.tags) ? filter.tags : [filter.tags];
        const toolTags = tool.tags || [];
        if (!requiredTags.some(tag => toolTags.includes(tag))) return false;
      }

      // Author filter
      if (filter.author && tool.author !== filter.author) return false;

      // Version filter
      if (filter.version && tool.version !== filter.version) return false;

      // Permission filter
      if (filter.permissions) {
        const requiredPermissions = tool.config?.permissions || [];
        if (!filter.permissions.some(perm => requiredPermissions.includes(perm))) return false;
      }

      // Featured filter
      if (filter.featured !== undefined && tool.config?.featured !== filter.featured) return false;

      // Deprecated filter
      if (filter.deprecated !== undefined && tool.config?.deprecated !== filter.deprecated) return false;

      // Search filter
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase();
        const searchFields = [
          tool.name,
          tool.displayName,
          tool.description,
          ...(tool.tags || [])
        ].join(' ').toLowerCase();
        
        if (!searchFields.includes(searchTerm)) return false;
      }

      return true;
    });
  }

  private sortTools(tools: ToolDefinition[], sortBy: string, order: 'asc' | 'desc'): ToolDefinition[] {
    return tools.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'rating':
          comparison = (a.metadata?.userRating || 0) - (b.metadata?.userRating || 0);
          break;
        case 'usage':
          comparison = (a.metadata?.usageCount || 0) - (b.metadata?.usageCount || 0);
          break;
        case 'updated':
          comparison = (a.metadata?.updatedAt?.getTime() || 0) - (b.metadata?.updatedAt?.getTime() || 0);
          break;
        case 'created':
          comparison = (a.metadata?.createdAt?.getTime() || 0) - (b.metadata?.createdAt?.getTime() || 0);
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return order === 'desc' ? -comparison : comparison;
    });
  }

  private generateFacets(tools: ToolDefinition[]): Record<string, Record<string, number>> {
    const facets: Record<string, Record<string, number>> = {
      categories: {},
      authors: {},
      tags: {},
    };

    tools.forEach(tool => {
      // Category facets
      facets.categories[tool.category] = (facets.categories[tool.category] || 0) + 1;

      // Author facets
      if (tool.author) {
        facets.authors[tool.author] = (facets.authors[tool.author] || 0) + 1;
      }

      // Tag facets
      tool.tags?.forEach(tag => {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1;
      });
    });

    return facets;
  }

  private generateTimeline(executions: any[]): Array<{
    timestamp: Date;
    count: number;
    avgDuration: number;
    errorRate: number;
  }> {
    // Group executions by day
    const dailyData: Record<string, {
      count: number;
      durations: number[];
      errors: number;
    }> = {};

    executions.forEach(execution => {
      const day = execution.createdAt.toISOString().split('T')[0];
      
      if (!dailyData[day]) {
        dailyData[day] = { count: 0, durations: [], errors: 0 };
      }
      
      dailyData[day].count++;
      if (execution.duration) dailyData[day].durations.push(execution.duration);
      if (execution.status === 'failed') dailyData[day].errors++;
    });

    // Convert to timeline format
    return Object.entries(dailyData)
      .map(([date, data]) => ({
        timestamp: new Date(date),
        count: data.count,
        avgDuration: data.durations.length > 0 
          ? data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length 
          : 0,
        errorRate: data.count > 0 ? (data.errors / data.count) * 100 : 0
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private async persistTool(tool: ToolDefinition): Promise<void> {
    try {
      await prisma.tool.upsert({
        where: { name: tool.name },
        create: {
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description,
          category: tool.category,
          schema: tool.jsonSchema || {},
          config: tool.config || {},
          metadata: tool.metadata || {},
          isSystem: tool.metadata?.source === 'system',
          version: tool.version,
          author: tool.author,
        },
        update: {
          displayName: tool.displayName,
          description: tool.description,
          category: tool.category,
          schema: tool.jsonSchema || {},
          config: tool.config || {},
          metadata: tool.metadata || {},
          version: tool.version,
          author: tool.author,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Failed to persist tool ${tool.name}:`, error);
    }
  }

  private async removeTool(name: string): Promise<void> {
    try {
      await prisma.tool.delete({
        where: { name },
      });
    } catch (error) {
      console.error(`Failed to remove tool ${name}:`, error);
    }
  }

  private clearCaches(types: string[] = ['all']): void {
    if (types.includes('all') || types.includes('user')) {
      this.userToolsCache.clear();
    }
    if (types.includes('all') || types.includes('tenant')) {
      this.tenantToolsCache.clear();
    }
    if (types.includes('all') || types.includes('search')) {
      this.searchCache.clear();
    }
  }

  private setupCacheCleanup(): void {
    if (!this.config.cacheEnabled) return;

    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const ttl = this.config.cacheTTL!;

      // Clean user cache
      for (const [key, entry] of this.userToolsCache) {
        if (now - entry.timestamp > ttl) {
          this.userToolsCache.delete(key);
        }
      }

      // Clean tenant cache
      for (const [key, entry] of this.tenantToolsCache) {
        if (now - entry.timestamp > ttl) {
          this.tenantToolsCache.delete(key);
        }
      }

      // Clean search cache
      for (const [key, entry] of this.searchCache) {
        if (now - entry.timestamp > ttl) {
          this.searchCache.delete(key);
        }
      }
    }, 300000); // 5 minutes
  }

  private async preloadTools(toolNames: string[]): Promise<void> {
    // This would load tools from database or external sources
    console.log(`Preloading tools: ${toolNames.join(', ')}`);
    // Implementation would depend on where tools are stored
  }

  private emitEvent(event: ToolEvent, payload: ToolEventPayload): void {
    // Emit to EventEmitter listeners
    this.emit(event, payload);

    // Emit to custom event handlers
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(async handler => {
        try {
          await handler(event, payload);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}