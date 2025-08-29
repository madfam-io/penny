import { prisma } from '../src/client.js';
import { createTenant } from '../src/tenant.js';

async function main() {
  console.log('🌱 Seeding database...');

  // Create system roles
  const roles = [
    {
      name: 'admin',
      description: 'Full system access',
      permissions: ['*'],
      isSystem: true,
    },
    {
      name: 'manager',
      description: 'Manage workspace and users',
      permissions: [
        'workspace:*',
        'user:read',
        'user:invite',
        'conversation:*',
        'artifact:*',
        'tool:*',
        'analytics:read',
      ],
      isSystem: true,
    },
    {
      name: 'creator',
      description: 'Create and manage own content',
      permissions: [
        'conversation:create',
        'conversation:read:own',
        'conversation:update:own',
        'conversation:delete:own',
        'artifact:create',
        'artifact:read',
        'artifact:update:own',
        'artifact:delete:own',
        'tool:execute',
      ],
      isSystem: true,
    },
    {
      name: 'viewer',
      description: 'View-only access',
      permissions: ['conversation:read', 'artifact:read', 'dashboard:read'],
      isSystem: true,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      create: role,
      update: role,
    });
  }

  console.log('✅ Roles created');

  // Create demo tenant
  const demoTenant = await createTenant({
    name: 'Demo Company',
    slug: 'demo',
    adminEmail: 'admin@demo.penny.ai',
    adminName: 'Demo Admin',
    adminPassword: 'demo123!@#',
  });

  console.log('✅ Demo tenant created:', demoTenant.tenant.slug);

  // Create additional demo users
  const { CryptoService } = await import('@penny/security');
  const crypto = new CryptoService(
    Buffer.from(process.env.MASTER_ENCRYPTION_KEY || 'change-this-32-byte-key-in-prod!'),
  );

  const demoUsers = [
    {
      email: 'john@demo.penny.ai',
      name: 'John Manager',
      role: 'manager',
    },
    {
      email: 'jane@demo.penny.ai',
      name: 'Jane Creator',
      role: 'creator',
    },
    {
      email: 'bob@demo.penny.ai',
      name: 'Bob Viewer',
      role: 'viewer',
    },
  ];

  for (const userData of demoUsers) {
    const user = await prisma.user.create({
      data: {
        tenantId: demoTenant.tenant.id,
        email: userData.email,
        name: userData.name,
        passwordHash: await crypto.hashPassword('demo123'),
        isActive: true,
        emailVerified: new Date(),
      },
    });

    const role = await prisma.role.findUnique({
      where: { name: userData.role },
    });

    if (role) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
          workspaceId: demoTenant.workspace.id,
        },
      });
    }
  }

  console.log('✅ Demo users created');

  // Create sample conversation
  const conversation = await prisma.conversation.create({
    data: {
      tenantId: demoTenant.tenant.id,
      workspaceId: demoTenant.workspace.id,
      userId: demoTenant.adminUser.id,
      title: 'Welcome to PENNY',
      metadata: {
        tags: ['demo', 'welcome'],
      },
    },
  });

  // Add messages
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      userId: demoTenant.adminUser.id,
      role: 'user',
      content: 'Hello PENNY, can you show me our company KPIs for this month?',
    },
  });

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: "I'll retrieve the company KPIs for this month. Let me fetch that data for you.",
      toolCalls: [
        {
          id: 'call_1',
          name: 'get_company_kpis',
          arguments: {
            period: 'MTD',
            unit: 'company',
          },
        },
      ],
    },
  });

  // Create sample artifact
  await prisma.artifact.create({
    data: {
      tenantId: demoTenant.tenant.id,
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      userId: demoTenant.adminUser.id,
      type: 'dashboard',
      mimeType: 'application/vnd.penny.dashboard+json',
      name: 'Company KPIs - MTD',
      description: 'Monthly company performance metrics',
      content: {
        type: 'dashboard',
        layout: 'grid',
        widgets: [
          {
            type: 'metric',
            title: 'Revenue',
            value: 1250000,
            change: 12,
            format: 'currency',
          },
          {
            type: 'metric',
            title: 'Customers',
            value: 156,
            change: 8,
            format: 'number',
          },
          {
            type: 'metric',
            title: 'NPS Score',
            value: 72,
            change: 0,
            format: 'number',
          },
          {
            type: 'chart',
            title: 'Revenue Trend',
            chartType: 'line',
            data: {
              labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
              datasets: [
                {
                  label: 'Revenue',
                  data: [280000, 310000, 295000, 365000],
                },
              ],
            },
          },
        ],
      },
      metadata: {
        period: 'MTD',
        generatedAt: new Date(),
      },
    },
  });

  console.log('✅ Sample conversation and artifacts created');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nDemo credentials:');
  console.log('  Admin: admin@demo.penny.ai / demo123!@#');
  console.log('  Manager: john@demo.penny.ai / demo123');
  console.log('  Creator: jane@demo.penny.ai / demo123');
  console.log('  Viewer: bob@demo.penny.ai / demo123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
