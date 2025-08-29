import type { Role, TenantId, UserId } from '@penny/shared';

export interface Permission {
  resource: string;
  action: string;
  scope?: 'own' | 'workspace' | 'tenant';
}

export interface RolePermissions {
  role: Role;
  permissions: Permission[];
}

const DEFAULT_PERMISSIONS: RolePermissions[] = [
  {
    role: Role.VIEWER,
    permissions: [
      { resource: 'conversation', action: 'read', scope: 'workspace' },
      { resource: 'artifact', action: 'read', scope: 'workspace' },
      { resource: 'dashboard', action: 'read', scope: 'workspace' },
      { resource: 'user', action: 'read', scope: 'own' },
    ],
  },
  {
    role: Role.CREATOR,
    permissions: [
      { resource: 'conversation', action: 'read', scope: 'workspace' },
      { resource: 'conversation', action: 'create', scope: 'workspace' },
      { resource: 'conversation', action: 'update', scope: 'own' },
      { resource: 'conversation', action: 'delete', scope: 'own' },
      { resource: 'artifact', action: 'read', scope: 'workspace' },
      { resource: 'artifact', action: 'create', scope: 'workspace' },
      { resource: 'artifact', action: 'update', scope: 'own' },
      { resource: 'artifact', action: 'delete', scope: 'own' },
      { resource: 'tool', action: 'execute', scope: 'workspace' },
      { resource: 'dashboard', action: 'read', scope: 'workspace' },
      { resource: 'dashboard', action: 'create', scope: 'workspace' },
      { resource: 'user', action: 'read', scope: 'own' },
      { resource: 'user', action: 'update', scope: 'own' },
    ],
  },
  {
    role: Role.MANAGER,
    permissions: [
      { resource: 'conversation', action: '*', scope: 'workspace' },
      { resource: 'artifact', action: '*', scope: 'workspace' },
      { resource: 'tool', action: '*', scope: 'workspace' },
      { resource: 'dashboard', action: '*', scope: 'workspace' },
      { resource: 'workspace', action: 'read', scope: 'workspace' },
      { resource: 'workspace', action: 'update', scope: 'workspace' },
      { resource: 'user', action: 'read', scope: 'workspace' },
      { resource: 'user', action: 'invite', scope: 'workspace' },
      { resource: 'user', action: 'remove', scope: 'workspace' },
      { resource: 'user', action: 'update', scope: 'own' },
      { resource: 'analytics', action: 'read', scope: 'workspace' },
    ],
  },
  {
    role: Role.ADMIN,
    permissions: [{ resource: '*', action: '*', scope: 'tenant' }],
  },
];

export class RBACService {
  private permissions: Map<Role, Permission[]>;

  constructor(customPermissions?: RolePermissions[]) {
    this.permissions = new Map();
    const permissions = customPermissions || DEFAULT_PERMISSIONS;

    for (const rolePermission of permissions) {
      this.permissions.set(rolePermission.role, rolePermission.permissions);
    }
  }

  canAccess(
    userRoles: Role[],
    resource: string,
    action: string,
    context: {
      ownerId?: UserId;
      workspaceId?: string;
      tenantId: TenantId;
      userId: UserId;
    },
  ): boolean {
    for (const role of userRoles) {
      const rolePermissions = this.permissions.get(role) || [];

      for (const permission of rolePermissions) {
        if (this.matchesPermission(permission, resource, action, context)) {
          return true;
        }
      }
    }

    return false;
  }

  private matchesPermission(
    permission: Permission,
    resource: string,
    action: string,
    context: {
      ownerId?: UserId;
      workspaceId?: string;
      tenantId: TenantId;
      userId: UserId;
    },
  ): boolean {
    // Check resource match
    if (permission.resource !== '*' && permission.resource !== resource) {
      return false;
    }

    // Check action match
    if (permission.action !== '*' && permission.action !== action) {
      return false;
    }

    // Check scope
    if (permission.scope === 'own' && context.ownerId !== context.userId) {
      return false;
    }

    // Workspace and tenant scopes are handled by data filtering
    return true;
  }

  getPermissionsForRole(role: Role): Permission[] {
    return this.permissions.get(role) || [];
  }

  getAllPermissions(roles: Role[]): Permission[] {
    const allPermissions: Permission[] = [];
    const seen = new Set<string>();

    for (const role of roles) {
      const rolePermissions = this.permissions.get(role) || [];

      for (const permission of rolePermissions) {
        const key = `${permission.resource}:${permission.action}:${permission.scope || 'any'}`;
        if (!seen.has(key)) {
          seen.add(key);
          allPermissions.push(permission);
        }
      }
    }

    return allPermissions;
  }
}
