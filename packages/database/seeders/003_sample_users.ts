import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

export async function seedSampleUsers() {
  console.log('👥 Seeding sample users...');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'penny' }
  });

  if (!tenant) {
    throw new Error('Default tenant not found. Run default tenant seeder first.');
  }

  // Get existing roles
  const roles = await prisma.role.findMany();
  const managerRole = roles.find(r => r.name === 'manager');
  const creatorRole = roles.find(r => r.name === 'creator');
  const viewerRole = roles.find(r => r.name === 'viewer');

  // Create roles if they don't exist
  if (!managerRole) {
    await prisma.role.create({
      data: {
        name: 'manager',
        displayName: 'Manager',
        description: 'Team management and configuration access',
        permissions: [
          'users:read',
          'users:invite',
          'conversations:read',
          'conversations:moderate',
          'tools:read',
          'tools:execute',
          'artifacts:read',
          'artifacts:create',
          'analytics:read',
          'workspace:manage'
        ]
      }
    });
  }

  if (!creatorRole) {
    await prisma.role.create({
      data: {
        name: 'creator',
        displayName: 'Creator',
        description: 'Content creation and collaboration',
        permissions: [
          'conversations:create',
          'conversations:read',
          'conversations:update',
          'tools:read',
          'tools:execute',
          'artifacts:create',
          'artifacts:read',
          'artifacts:update',
          'artifacts:share'
        ]
      }
    });
  }

  if (!viewerRole) {
    await prisma.role.create({
      data: {
        name: 'viewer',
        displayName: 'Viewer',
        description: 'Read-only access to shared content',
        permissions: [
          'conversations:read',
          'tools:read',
          'artifacts:read'
        ]
      }
    });
  }

  // Get workspace
  const workspace = await prisma.workspace.findFirst({
    where: {
      tenantId: tenant.id,
      isDefault: true
    }
  });

  if (!workspace) {
    throw new Error('Default workspace not found');
  }

  // Sample user data
  const sampleUsers = [
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@example.com',
      role: 'manager',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612c93c?w=150',
      bio: 'Product Manager with 8 years of experience in AI and ML products'
    },
    {
      name: 'Michael Chen',
      email: 'michael.chen@example.com',
      role: 'creator',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      bio: 'Full-stack developer passionate about conversational AI'
    },
    {
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@example.com',
      role: 'creator',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      bio: 'Data scientist specializing in natural language processing'
    },
    {
      name: 'David Kim',
      email: 'david.kim@example.com',
      role: 'creator',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      bio: 'UX designer focused on AI-human interaction'
    },
    {
      name: 'Lisa Wang',
      email: 'lisa.wang@example.com',
      role: 'viewer',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'Business analyst exploring AI applications'
    },
    {
      name: 'James Thompson',
      email: 'james.thompson@example.com',
      role: 'creator',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      bio: 'DevOps engineer interested in AI automation'
    },
    {
      name: 'Maria Garcia',
      email: 'maria.garcia@example.com',
      role: 'manager',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      bio: 'Marketing manager leveraging AI for content creation'
    },
    {
      name: 'Robert Brown',
      email: 'robert.brown@example.com',
      role: 'creator',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
      bio: 'Research scientist in machine learning and AI ethics'
    }
  ];

  const createdUsers = [];

  for (const userData of sampleUsers) {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: userData.email
      }
    });

    if (existingUser) {
      console.log(`User ${userData.email} already exists, skipping...`);
      continue;
    }

    // Create user
    const passwordHash = await bcrypt.hash('password123', 12);
    
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: userData.email,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        name: userData.name,
        passwordHash,
        avatar: userData.avatar,
        locale: 'en',
        timezone: faker.location.timeZone(),
        theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
        preferences: {
          notifications: {
            email: faker.datatype.boolean(),
            browser: faker.datatype.boolean(),
            digest: faker.datatype.boolean()
          },
          ui: {
            sidebarCollapsed: faker.datatype.boolean(),
            density: faker.helpers.arrayElement(['compact', 'comfortable', 'spacious']),
            language: 'en'
          },
          ai: {
            preferredModel: faker.helpers.arrayElement(['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet']),
            temperature: faker.number.float({ min: 0.1, max: 1.0, precision: 0.1 })
          },
          bio: userData.bio
        },
        status: 'active',
        lastLoginAt: faker.date.recent({ days: 30 }),
        lastActiveAt: faker.date.recent({ days: 7 })
      }
    });

    // Assign role
    const roleToAssign = await prisma.role.findFirst({
      where: { name: userData.role }
    });

    if (roleToAssign) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: roleToAssign.id,
          workspaceId: workspace.id,
          assignedBy: user.id // self-assigned for demo
        }
      });
    }

    // Create user notification preferences
    await prisma.userNotificationPreference.create({
      data: {
        userId: user.id,
        emailEnabled: faker.datatype.boolean(),
        smsEnabled: false,
        pushEnabled: faker.datatype.boolean(),
        inAppEnabled: true,
        eventPreferences: {
          'conversation.created': true,
          'conversation.shared': true,
          'tool.completed': true,
          'artifact.created': true,
          'mention.received': true,
          'comment.added': false
        },
        digestEnabled: faker.datatype.boolean(),
        digestFrequency: faker.helpers.arrayElement(['immediate', 'hourly', 'daily', 'weekly']),
        quietHoursStart: '22:00:00',
        quietHoursEnd: '08:00:00',
        timezone: user.timezone || 'UTC',
        emailVerified: true
      }
    });

    createdUsers.push(user);
  }

  // Create some random additional users for testing load
  const additionalUserCount = 25;
  
  for (let i = 0; i < additionalUserCount; i++) {
    const email = faker.internet.email().toLowerCase();
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: email
      }
    });

    if (existingUser) continue;

    const passwordHash = await bcrypt.hash('password123', 12);
    
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: email,
        emailVerified: faker.datatype.boolean({ probability: 0.8 }),
        emailVerifiedAt: faker.datatype.boolean({ probability: 0.8 }) ? faker.date.recent({ days: 60 }) : null,
        name: faker.person.fullName(),
        passwordHash,
        avatar: faker.datatype.boolean({ probability: 0.3 }) ? faker.image.avatar() : null,
        locale: faker.helpers.arrayElement(['en', 'es', 'fr', 'de', 'pt']),
        timezone: faker.location.timeZone(),
        theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
        preferences: {
          notifications: {
            email: faker.datatype.boolean(),
            browser: faker.datatype.boolean(),
            digest: faker.datatype.boolean()
          },
          ui: {
            sidebarCollapsed: faker.datatype.boolean(),
            density: faker.helpers.arrayElement(['compact', 'comfortable', 'spacious'])
          }
        },
        status: faker.helpers.weightedArrayElement([
          { weight: 0.8, value: 'active' },
          { weight: 0.15, value: 'inactive' },
          { weight: 0.05, value: 'suspended' }
        ]),
        lastLoginAt: faker.datatype.boolean({ probability: 0.7 }) ? faker.date.recent({ days: 90 }) : null,
        lastActiveAt: faker.datatype.boolean({ probability: 0.6 }) ? faker.date.recent({ days: 30 }) : null
      }
    });

    // Assign random role
    const randomRole = faker.helpers.arrayElement([creatorRole, viewerRole]);
    if (randomRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: randomRole.id,
          workspaceId: workspace.id,
          assignedBy: user.id
        }
      });
    }

    createdUsers.push(user);
  }

  console.log(`✅ Created ${createdUsers.length} sample users`);
  console.log(`📊 Sample users by role:`);
  
  const roleCounts = await prisma.userRole.groupBy({
    by: ['roleId'],
    _count: {
      userId: true
    },
    where: {
      user: {
        tenantId: tenant.id
      }
    }
  });

  for (const roleCount of roleCounts) {
    const role = await prisma.role.findUnique({
      where: { id: roleCount.roleId }
    });
    console.log(`   ${role?.displayName || 'Unknown'}: ${roleCount._count.userId} users`);
  }

  return createdUsers;
}

if (require.main === module) {
  seedSampleUsers()
    .then(() => {
      console.log('Sample users seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding sample users:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}