import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedFeatureFlags() {
  console.log('🚀 Seeding feature flags...');

  const systemFeatureFlags = [
    {
      key: 'chat_streaming',
      name: 'Chat Streaming',
      description: 'Enable real-time streaming of chat responses',
      isEnabled: true,
      conditions: {},
      rolloutPercentage: 100,
      metadata: {
        category: 'chat',
        impact: 'low',
        dependencies: ['websockets']
      }
    },
    {
      key: 'multi_model_support',
      name: 'Multi-Model Support',
      description: 'Allow users to select different AI models for conversations',
      isEnabled: true,
      conditions: {
        plans: ['starter', 'professional', 'business', 'enterprise']
      },
      rolloutPercentage: 100,
      metadata: {
        category: 'ai',
        impact: 'medium',
        billingImpact: true
      }
    },
    {
      key: 'tool_marketplace',
      name: 'Tool Marketplace',
      description: 'Public marketplace for sharing and discovering tools',
      isEnabled: false,
      conditions: {},
      rolloutPercentage: 0,
      metadata: {
        category: 'tools',
        impact: 'high',
        phase: 'development'
      }
    },
    {
      key: 'collaborative_editing',
      name: 'Collaborative Editing',
      description: 'Real-time collaborative editing of conversations and artifacts',
      isEnabled: true,
      conditions: {
        plans: ['professional', 'business', 'enterprise']
      },
      rolloutPercentage: 100,
      metadata: {
        category: 'collaboration',
        impact: 'high',
        dependencies: ['websockets', 'operational_transform']
      }
    },
    {
      key: 'advanced_analytics',
      name: 'Advanced Analytics',
      description: 'Detailed usage analytics and business intelligence',
      isEnabled: true,
      conditions: {
        plans: ['business', 'enterprise']
      },
      rolloutPercentage: 100,
      metadata: {
        category: 'analytics',
        impact: 'medium'
      }
    },
    {
      key: 'custom_themes',
      name: 'Custom Themes',
      description: 'Allow tenants to customize UI themes and branding',
      isEnabled: true,
      conditions: {
        plans: ['professional', 'business', 'enterprise']
      },
      rolloutPercentage: 100,
      metadata: {
        category: 'ui',
        impact: 'low'
      }
    },
    {
      key: 'api_v2',
      name: 'API v2',
      description: 'Next generation REST API with GraphQL support',
      isEnabled: false,
      conditions: {
        betaUsers: true
      },
      rolloutPercentage: 10,
      metadata: {
        category: 'api',
        impact: 'high',
        phase: 'beta'
      }
    },
    {
      key: 'voice_input',
      name: 'Voice Input',
      description: 'Speech-to-text input for conversations',
      isEnabled: false,
      conditions: {
        browserSupport: ['chrome', 'firefox', 'safari', 'edge']
      },
      rolloutPercentage: 25,
      metadata: {
        category: 'input',
        impact: 'medium',
        experimental: true
      }
    },
    {
      key: 'pdf_processing',
      name: 'PDF Processing',
      description: 'Enhanced PDF document processing and analysis',
      isEnabled: true,
      conditions: {},
      rolloutPercentage: 100,
      metadata: {
        category: 'documents',
        impact: 'medium'
      }
    },
    {
      key: 'webhook_v2',
      name: 'Webhooks v2',
      description: 'Enhanced webhook system with retry logic and better security',
      isEnabled: true,
      conditions: {
        plans: ['starter', 'professional', 'business', 'enterprise']
      },
      rolloutPercentage: 100,
      metadata: {
        category: 'integrations',
        impact: 'medium'
      }
    },
    {
      key: 'conversation_export',
      name: 'Conversation Export',
      description: 'Export conversations in various formats (PDF, JSON, Markdown)',
      isEnabled: true,
      conditions: {},
      rolloutPercentage: 100,
      metadata: {
        category: 'export',
        impact: 'low'
      }
    },
    {
      key: 'artifact_versioning',
      name: 'Artifact Versioning',
      description: 'Version control and history for artifacts',
      isEnabled: true,
      conditions: {
        plans: ['professional', 'business', 'enterprise']
      },
      rolloutPercentage: 100,
      metadata: {
        category: 'artifacts',
        impact: 'medium'
      }
    },
    {
      key: 'sso_integration',
      name: 'SSO Integration',
      description: 'Single Sign-On with SAML, OAuth, and OpenID Connect',
      isEnabled: true,
      conditions: {
        plans: ['business', 'enterprise']
      },
      rolloutPercentage: 100,
      metadata: {
        category: 'auth',
        impact: 'high'
      }
    },
    {
      key: 'audit_logging',
      name: 'Comprehensive Audit Logging',
      description: 'Detailed audit logs for compliance and security',
      isEnabled: true,
      conditions: {
        plans: ['business', 'enterprise']
      },
      rolloutPercentage: 100,
      metadata: {
        category: 'security',
        impact: 'high',
        compliance: true
      }
    },
    {
      key: 'rate_limiting',
      name: 'Advanced Rate Limiting',
      description: 'Granular rate limiting with burst allowance',
      isEnabled: true,
      conditions: {},
      rolloutPercentage: 100,
      metadata: {
        category: 'security',
        impact: 'medium'
      }
    },
    {
      key: 'content_moderation',
      name: 'Content Moderation',
      description: 'AI-powered content moderation and filtering',
      isEnabled: true,
      conditions: {},
      rolloutPercentage: 100,
      metadata: {
        category: 'safety',
        impact: 'high'
      }
    },
    {
      key: 'conversation_search',
      name: 'Conversation Search',
      description: 'Full-text search across conversation history',
      isEnabled: true,
      conditions: {},
      rolloutPercentage: 100,
      metadata: {
        category: 'search',
        impact: 'medium'
      }
    },
    {
      key: 'mobile_app',
      name: 'Mobile App Support',
      description: 'Enhanced mobile web app experience',
      isEnabled: false,
      conditions: {},
      rolloutPercentage: 50,
      metadata: {
        category: 'mobile',
        impact: 'high',
        phase: 'development'
      }
    },
    {
      key: 'workflow_automation',
      name: 'Workflow Automation',
      description: 'Automated workflows and tool chaining',
      isEnabled: false,
      conditions: {
        plans: ['business', 'enterprise'],
        betaUsers: true
      },
      rolloutPercentage: 5,
      metadata: {
        category: 'automation',
        impact: 'high',
        experimental: true
      }
    },
    {
      key: 'team_workspaces',
      name: 'Team Workspaces',
      description: 'Isolated workspaces for different teams within a tenant',
      isEnabled: true,
      conditions: {
        plans: ['professional', 'business', 'enterprise']
      },
      rolloutPercentage: 100,
      metadata: {
        category: 'collaboration',
        impact: 'medium'
      }
    },
    {
      key: 'usage_analytics',
      name: 'Usage Analytics',
      description: 'Real-time usage tracking and cost monitoring',
      isEnabled: true,
      conditions: {},
      rolloutPercentage: 100,
      metadata: {
        category: 'analytics',
        impact: 'medium'
      }
    },
    {
      key: 'plugin_system',
      name: 'Plugin System',
      description: 'Third-party plugin support and marketplace',
      isEnabled: false,
      conditions: {
        plans: ['enterprise'],
        betaUsers: true
      },
      rolloutPercentage: 0,
      metadata: {
        category: 'extensibility',
        impact: 'high',
        phase: 'planning'
      }
    }
  ];

  const createdFlags = [];

  for (const flagData of systemFeatureFlags) {
    const flag = await prisma.featureFlag.upsert({
      where: {
        key: flagData.key
      },
      update: {
        name: flagData.name,
        description: flagData.description,
        isEnabled: flagData.isEnabled,
        conditions: flagData.conditions,
        rolloutPercentage: flagData.rolloutPercentage,
        metadata: {
          ...flagData.metadata,
          lastUpdated: new Date().toISOString()
        }
      },
      create: {
        key: flagData.key,
        name: flagData.name,
        description: flagData.description,
        isEnabled: flagData.isEnabled,
        conditions: flagData.conditions,
        rolloutPercentage: flagData.rolloutPercentage,
        metadata: {
          ...flagData.metadata,
          createdAt: new Date().toISOString()
        }
      }
    });

    createdFlags.push(flag);
  }

  // Create tenant-specific overrides for the default tenant
  const defaultTenant = await prisma.tenant.findFirst({
    where: { slug: 'penny' }
  });

  if (defaultTenant) {
    const tenantOverrides = [
      {
        featureFlagKey: 'tool_marketplace',
        isEnabled: true, // Enable for default tenant
        conditions: {
          reason: 'Demo tenant - showcase all features'
        }
      },
      {
        featureFlagKey: 'api_v2',
        isEnabled: true,
        conditions: {
          reason: 'Development tenant - test new API'
        }
      },
      {
        featureFlagKey: 'workflow_automation',
        isEnabled: true,
        conditions: {
          reason: 'Demo tenant - showcase automation features'
        }
      }
    ];

    for (const override of tenantOverrides) {
      const featureFlag = createdFlags.find(f => f.key === override.featureFlagKey);
      if (featureFlag) {
        await prisma.featureFlagOverride.upsert({
          where: {
            featureFlagId_tenantId_userId: {
              featureFlagId: featureFlag.id,
              tenantId: defaultTenant.id,
              userId: null
            }
          },
          update: {
            isEnabled: override.isEnabled,
            conditions: override.conditions
          },
          create: {
            featureFlagId: featureFlag.id,
            tenantId: defaultTenant.id,
            isEnabled: override.isEnabled,
            conditions: override.conditions
          }
        });
      }
    }

    console.log(`✅ Created ${tenantOverrides.length} tenant-specific overrides`);
  }

  // Create user-specific overrides for beta users
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@penny.ai' }
  });

  if (adminUser) {
    const userOverrides = [
      {
        featureFlagKey: 'mobile_app',
        isEnabled: true
      },
      {
        featureFlagKey: 'voice_input',
        isEnabled: true
      }
    ];

    for (const override of userOverrides) {
      const featureFlag = createdFlags.find(f => f.key === override.featureFlagKey);
      if (featureFlag) {
        await prisma.featureFlagOverride.upsert({
          where: {
            featureFlagId_tenantId_userId: {
              featureFlagId: featureFlag.id,
              tenantId: null,
              userId: adminUser.id
            }
          },
          update: {
            isEnabled: override.isEnabled
          },
          create: {
            featureFlagId: featureFlag.id,
            userId: adminUser.id,
            isEnabled: override.isEnabled
          }
        });
      }
    }

    console.log(`✅ Created ${userOverrides.length} user-specific overrides for admin`);
  }

  console.log(`✅ Created/updated ${createdFlags.length} feature flags`);
  console.log('🎯 Feature flags by category:');

  const categories = {};
  for (const flag of createdFlags) {
    const category = flag.metadata?.category || 'uncategorized';
    categories[category] = (categories[category] || 0) + 1;
  }

  for (const [category, count] of Object.entries(categories)) {
    console.log(`   ${category}: ${count} flags`);
  }

  console.log('📊 Feature flag status:');
  const enabledCount = createdFlags.filter(f => f.isEnabled).length;
  const disabledCount = createdFlags.length - enabledCount;
  console.log(`   Enabled: ${enabledCount}`);
  console.log(`   Disabled: ${disabledCount}`);

  return createdFlags;
}

if (require.main === module) {
  seedFeatureFlags()
    .then(() => {
      console.log('Feature flags seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding feature flags:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}