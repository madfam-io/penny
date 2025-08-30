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
export declare class RBACService {
    private permissions;
    constructor(customPermissions?: RolePermissions[]);
    canAccess(userRoles: Role[], resource: string, action: string, context: {
        ownerId?: UserId;
        workspaceId?: string;
        tenantId: TenantId;
        userId: UserId;
    }): boolean;
    private matchesPermission;
    getPermissionsForRole(role: Role): Permission[];
    getAllPermissions(roles: Role[]): Permission[];
}
//# sourceMappingURL=index.d.ts.map