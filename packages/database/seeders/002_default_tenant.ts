import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedDefaultTenant() {
  console.log('🏢 Seeding default tenant configuration...');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'penny' }
  });

  if (!tenant) {
    throw new Error('Default tenant not found. Run admin user seeder first.');
  }

  // Create tenant settings
  const settingsData = [
    {
      key: 'branding.primaryColor',
      value: '#6366f1',
      description: 'Primary brand color for the tenant',
      category: 'branding'
    },
    {
      key: 'branding.logo',
      value: '/assets/logo.png',
      description: 'Tenant logo URL',
      category: 'branding'
    },
    {
      key: 'branding.favicon',
      value: '/assets/favicon.ico',
      description: 'Tenant favicon URL',
      category: 'branding'
    },
    {
      key: 'auth.allowSignup',
      value: true,
      description: 'Allow new user registration',
      category: 'authentication'
    },
    {
      key: 'auth.requireEmailVerification',
      value: false,
      description: 'Require email verification for new users',
      category: 'authentication'
    },
    {
      key: 'auth.sessionTimeout',
      value: 86400, // 24 hours in seconds
      description: 'Session timeout in seconds',
      category: 'authentication'
    },
    {
      key: 'features.chat.enabled',
      value: true,
      description: 'Enable chat functionality',
      category: 'features'
    },
    {
      key: 'features.tools.enabled',
      value: true,
      description: 'Enable tool execution',
      category: 'features'
    },
    {
      key: 'features.artifacts.enabled',
      value: true,
      description: 'Enable artifact creation and viewing',
      category: 'features'
    },
    {
      key: 'features.collaboration.enabled',
      value: true,
      description: 'Enable collaborative features',
      category: 'features'
    },
    {
      key: 'limits.maxUsersPerTenant',
      value: 1000,
      description: 'Maximum users per tenant',
      category: 'limits'
    },
    {
      key: 'limits.maxConversationsPerUser',
      value: 100,
      description: 'Maximum conversations per user',
      category: 'limits'
    },
    {
      key: 'limits.maxMessagesPerConversation',
      value: 1000,
      description: 'Maximum messages per conversation',
      category: 'limits'
    },
    {
      key: 'limits.maxArtifactSizeMB',
      value: 50,
      description: 'Maximum artifact size in megabytes',
      category: 'limits'
    },
    {
      key: 'ai.defaultModel',
      value: 'gpt-4',
      description: 'Default AI model for conversations',
      category: 'ai'
    },
    {
      key: 'ai.enabledProviders',
      value: ['openai', 'anthropic', 'ollama'],
      description: 'Enabled AI providers',
      category: 'ai'
    },
    {
      key: 'storage.provider',
      value: 's3',
      description: 'Storage provider for artifacts',
      category: 'storage'
    },
    {
      key: 'notifications.defaultChannels',
      value: ['email', 'in_app'],
      description: 'Default notification channels',
      category: 'notifications'
    }
  ];

  for (const setting of settingsData) {
    await prisma.tenantSetting.upsert({
      where: {
        tenantId_key: {
          tenantId: tenant.id,
          key: setting.key
        }
      },
      update: {
        value: setting.value,
        description: setting.description,
        category: setting.category
      },
      create: {
        tenantId: tenant.id,
        key: setting.key,
        value: setting.value,
        description: setting.description,
        category: setting.category
      }
    });
  }

  // Create tenant feature flags
  const featureFlags = [
    {
      featureKey: 'beta_features',
      isEnabled: false,
      config: {
        description: 'Enable beta features for testing'
      }
    },
    {
      featureKey: 'advanced_analytics',
      isEnabled: true,
      config: {
        description: 'Advanced analytics dashboard'
      }
    },
    {
      featureKey: 'custom_tools',
      isEnabled: true,
      config: {
        description: 'Allow custom tool creation'
      }
    },
    {
      featureKey: 'ai_model_selection',
      isEnabled: true,
      config: {
        description: 'Allow users to select AI models'
      }
    },
    {
      featureKey: 'collaboration',
      isEnabled: true,
      config: {
        description: 'Collaborative editing and sharing'
      }
    },
    {
      featureKey: 'api_access',
      isEnabled: true,
      config: {
        description: 'REST API access'
      }
    },
    {
      featureKey: 'webhooks',
      isEnabled: true,
      config: {
        description: 'Webhook integration support'
      }
    }
  ];

  for (const flag of featureFlags) {
    await prisma.tenantFeature.upsert({
      where: {
        tenantId_featureKey: {
          tenantId: tenant.id,
          featureKey: flag.featureKey
        }
      },
      update: {
        isEnabled: flag.isEnabled,
        config: flag.config
      },
      create: {
        tenantId: tenant.id,
        featureKey: flag.featureKey,
        isEnabled: flag.isEnabled,
        config: flag.config,
        enabledAt: flag.isEnabled ? new Date() : null
      }
    });
  }

  // Create tenant limits
  const limitsData = [
    {
      resourceType: 'users',
      limitValue: 1000,
      currentUsage: 1 // admin user
    },
    {
      resourceType: 'conversations',
      limitValue: -1, // unlimited
      currentUsage: 0
    },
    {
      resourceType: 'messages',
      limitValue: -1, // unlimited
      currentUsage: 0
    },
    {
      resourceType: 'artifacts',
      limitValue: 10000,
      currentUsage: 0
    },
    {
      resourceType: 'storage_bytes',
      limitValue: 100 * 1024 * 1024 * 1024, // 100GB
      currentUsage: 0
    },
    {
      resourceType: 'api_calls_monthly',
      limitValue: 10000,
      currentUsage: 0,
      resetPeriod: 'monthly'
    },
    {
      resourceType: 'tool_executions_daily',
      limitValue: 1000,
      currentUsage: 0,
      resetPeriod: 'daily'
    }
  ];

  for (const limit of limitsData) {
    await prisma.tenantLimit.upsert({
      where: {
        tenantId_resourceType: {
          tenantId: tenant.id,
          resourceType: limit.resourceType
        }
      },
      update: {
        limitValue: limit.limitValue,
        currentUsage: limit.currentUsage,
        resetPeriod: limit.resetPeriod
      },
      create: {
        tenantId: tenant.id,
        resourceType: limit.resourceType,
        limitValue: limit.limitValue,
        currentUsage: limit.currentUsage,
        resetPeriod: limit.resetPeriod,
        lastResetAt: limit.resetPeriod ? new Date() : null
      }
    });
  }

  // Create billing address
  await prisma.billingAddress.upsert({
    where: {
      tenantId: tenant.id
    },
    update: {},
    create: {
      tenantId: tenant.id,
      companyName: 'Penny Platform',
      line1: '123 Innovation Drive',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'US',
      email: 'billing@penny.ai',
      phone: '+1-555-0123',
      isActive: true
    }
  });

  console.log(`✅ Default tenant configuration completed`);
  console.log(`📊 Created ${settingsData.length} tenant settings`);
  console.log(`🚀 Created ${featureFlags.length} feature flags`);
  console.log(`📈 Created ${limitsData.length} usage limits`);

  return tenant;
}

if (require.main === module) {
  seedDefaultTenant()
    .then(() => {
      console.log('Default tenant seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding default tenant:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}