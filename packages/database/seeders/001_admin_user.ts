import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedAdminUser() {
  console.log('🔑 Seeding admin user...');

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      email: 'admin@penny.ai'
    }
  });

  if (existingAdmin) {
    console.log('Admin user already exists, skipping...');
    return existingAdmin;
  }

  // Create default tenant if it doesn't exist
  let defaultTenant = await prisma.tenant.findFirst({
    where: { slug: 'penny' }
  });

  if (!defaultTenant) {
    defaultTenant = await prisma.tenant.create({
      data: {
        name: 'Penny Platform',
        slug: 'penny',
        status: 'active',
        primaryColor: '#6366f1',
        settings: {
          allowSignup: true,
          requireEmailVerification: false,
          defaultTheme: 'system',
          features: {
            chat: true,
            tools: true,
            artifacts: true,
            collaboration: true
          }
        },
        features: {
          multiTenant: true,
          customBranding: true,
          advancedAnalytics: true,
          apiAccess: true,
          webhooks: true,
          sso: false
        },
        limits: {
          users: 1000,
          conversations: -1, // unlimited
          messages: -1, // unlimited
          storage: 100 * 1024 * 1024 * 1024, // 100GB
          apiCalls: 10000
        }
      }
    });
  }

  // Create admin role if it doesn't exist
  let adminRole = await prisma.role.findFirst({
    where: { name: 'admin' }
  });

  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full system access with all permissions',
        permissions: [
          'users:create',
          'users:read',
          'users:update',
          'users:delete',
          'tenants:create',
          'tenants:read',
          'tenants:update',
          'tenants:delete',
          'conversations:read',
          'conversations:moderate',
          'tools:create',
          'tools:read',
          'tools:update',
          'tools:delete',
          'tools:execute',
          'artifacts:read',
          'artifacts:moderate',
          'billing:read',
          'billing:manage',
          'analytics:read',
          'system:admin'
        ],
        isSystem: true
      }
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash('admin123!@#', 12);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      tenantId: defaultTenant.id,
      email: 'admin@penny.ai',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      name: 'System Administrator',
      passwordHash,
      avatar: null,
      locale: 'en',
      timezone: 'UTC',
      theme: 'system',
      preferences: {
        notifications: {
          email: true,
          browser: true,
          digest: false
        },
        ui: {
          sidebarCollapsed: false,
          density: 'comfortable',
          theme: 'system'
        }
      },
      status: 'active',
      lastLoginAt: null
    }
  });

  // Assign admin role
  await prisma.userRole.create({
    data: {
      userId: adminUser.id,
      roleId: adminRole.id,
      assignedBy: adminUser.id // self-assigned for initial setup
    }
  });

  // Create default workspace
  const defaultWorkspace = await prisma.workspace.create({
    data: {
      tenantId: defaultTenant.id,
      name: 'General',
      description: 'Default workspace for all users',
      slug: 'general',
      isDefault: true,
      settings: {
        visibility: 'public',
        allowGuestAccess: false,
        features: {
          tools: true,
          artifacts: true,
          collaboration: true
        }
      }
    }
  });

  // Create API key for admin user
  const apiKeyHash = await bcrypt.hash(`pk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 10);
  
  await prisma.apiKey.create({
    data: {
      tenantId: defaultTenant.id,
      userId: adminUser.id,
      name: 'Admin API Key',
      keyHash: apiKeyHash,
      scopes: [
        'read:users',
        'write:users',
        'read:tenants',
        'write:tenants',
        'read:conversations',
        'write:conversations',
        'execute:tools',
        'read:artifacts',
        'write:artifacts',
        'read:analytics'
      ],
      metadata: {
        description: 'Administrative API access',
        createdBy: 'system',
        environment: 'development'
      }
    }
  });

  console.log(`✅ Admin user created successfully`);
  console.log(`📧 Email: admin@penny.ai`);
  console.log(`🔒 Password: admin123!@#`);
  console.log(`🏢 Tenant: ${defaultTenant.name} (${defaultTenant.slug})`);
  console.log(`💼 Workspace: ${defaultWorkspace.name}`);

  return adminUser;
}

if (require.main === module) {
  seedAdminUser()
    .then(() => {
      console.log('Admin user seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding admin user:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}