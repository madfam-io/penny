import type { Prisma } from '@prisma/client';

// Re-export useful Prisma types
export type {
  Tenant,
  User,
  Role,
  UserRole,
  Session,
  Workspace,
  Conversation,
  Message,
  Memory,
  Artifact,
  Tool,
  ToolExecution,
  DataSource,
  Document,
  ApiKey,
  AuditLog,
  UsageMetric,
} from '@prisma/client';

// Custom types for includes
export type TenantWithRelations = Prisma.TenantGetPayload<{
  include: {
    users: true;
    workspaces: true;
  };
}>;

export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    tenant: true;
    roles: {
      include: {
        role: true;
      };
    };
  };
}>;

export type ConversationWithMessages = Prisma.ConversationGetPayload<{
  include: {
    messages: {
      orderBy: {
        createdAt: 'asc';
      };
    };
    artifacts: true;
    user: true;
  };
}>;

export type MessageWithArtifacts = Prisma.MessageGetPayload<{
  include: {
    artifacts: true;
    user: true;
  };
}>;

// Enums
export enum ToolExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool',
}

export enum ArtifactType {
  TEXT = 'text',
  MARKDOWN = 'markdown',
  CHART = 'chart',
  DASHBOARD = 'dashboard',
  IMAGE = 'image',
  DOCUMENT = 'document',
}

// Input types
export type CreateUserInput = Omit<
  Prisma.UserCreateInput,
  'tenant' | 'createdAt' | 'updatedAt'
> & {
  tenantId: string;
};

export type CreateConversationInput = {
  workspaceId: string;
  userId: string;
  title?: string;
  metadata?: Record<string, any>;
};

export type CreateMessageInput = {
  conversationId: string;
  userId?: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, any>;
  parentMessageId?: string;
  toolCalls?: any;
};

export type CreateArtifactInput = {
  conversationId?: string;
  messageId?: string;
  userId: string;
  type: ArtifactType;
  mimeType: string;
  name: string;
  description?: string;
  content?: any;
  storageUrl?: string;
  size?: number;
  metadata?: Record<string, any>;
};