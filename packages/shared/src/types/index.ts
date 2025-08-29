export type TenantId = string & { readonly brand: unique symbol };
export type UserId = string & { readonly brand: unique symbol };
export type WorkspaceId = string & { readonly brand: unique symbol };
export type ConversationId = string & { readonly brand: unique symbol };
export type ArtifactId = string & { readonly brand: unique symbol };

export interface Tenant {
  id: TenantId;
  name: string;
  slug: string;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  features: FeatureFlags;
  theme: ThemeConfig;
  security: SecurityConfig;
  limits: ResourceLimits;
}

export interface FeatureFlags {
  enabledModels: string[];
  enabledTools: string[];
  enabledIntegrations: string[];
  codeExecution: boolean;
  externalModels: boolean;
  customPlugins: boolean;
}

export interface ThemeConfig {
  primaryColor: string;
  logo?: string;
  favicon?: string;
  customCss?: string;
}

export interface SecurityConfig {
  allowedDomains: string[];
  ipWhitelist?: string[];
  mfaRequired: boolean;
  sessionTimeout: number;
  dataRetentionDays: number;
}

export interface ResourceLimits {
  maxUsers: number;
  maxWorkspaces: number;
  maxConversationsPerDay: number;
  maxTokensPerDay: number;
  maxStorageGB: number;
}

export interface User {
  id: UserId;
  tenantId: TenantId;
  email: string;
  name: string;
  roles: Role[];
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface UserPreferences {
  locale: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  digest: 'realtime' | 'hourly' | 'daily' | 'weekly';
}

export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CREATOR = 'creator',
  VIEWER = 'viewer',
}

export interface AuditLog {
  id: string;
  tenantId: TenantId;
  userId: UserId;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
