import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedPricingPlans() {
  console.log('💰 Seeding pricing plans...');

  const pricingPlans = [
    {
      name: 'Free',
      slug: 'free',
      description: 'Perfect for individuals getting started with AI conversations',
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'USD',
      features: {
        conversations: 10,
        messagesPerConversation: 50,
        toolExecutions: 100,
        artifactStorage: '1GB',
        modelAccess: ['gpt-3.5-turbo'],
        supportLevel: 'community',
        customTools: false,
        apiAccess: false,
        webhooks: false,
        analytics: 'basic',
        collaboration: false,
        customBranding: false,
        sso: false,
        priority: 'standard'
      },
      limits: {
        users: 1,
        conversations: 10,
        messagesPerMonth: 500,
        toolExecutions: 100,
        storageBytes: 1024 * 1024 * 1024, // 1GB
        apiCalls: 0,
        webhooks: 0
      },
      isActive: true,
      isFeatured: false,
      trialDays: 0,
      sortOrder: 1
    },
    {
      name: 'Starter',
      slug: 'starter',
      description: 'Ideal for small teams and professionals',
      priceMonthly: 1999, // $19.99
      priceYearly: 19199, // $191.99 (20% discount)
      currency: 'USD',
      features: {
        conversations: 100,
        messagesPerConversation: 200,
        toolExecutions: 1000,
        artifactStorage: '10GB',
        modelAccess: ['gpt-3.5-turbo', 'gpt-4', 'claude-3-haiku'],
        supportLevel: 'email',
        customTools: true,
        apiAccess: true,
        webhooks: 5,
        analytics: 'standard',
        collaboration: true,
        customBranding: false,
        sso: false,
        priority: 'standard'
      },
      limits: {
        users: 5,
        conversations: 100,
        messagesPerMonth: 5000,
        toolExecutions: 1000,
        storageBytes: 10 * 1024 * 1024 * 1024, // 10GB
        apiCalls: 5000,
        webhooks: 5
      },
      isActive: true,
      isFeatured: true,
      trialDays: 14,
      sortOrder: 2,
      stripeProductId: 'prod_starter',
      stripePriceMonthlyId: 'price_starter_monthly',
      stripePriceYearlyId: 'price_starter_yearly'
    },
    {
      name: 'Professional',
      slug: 'professional',
      description: 'Advanced features for growing businesses',
      priceMonthly: 4999, // $49.99
      priceYearly: 47999, // $479.99 (20% discount)
      currency: 'USD',
      features: {
        conversations: 500,
        messagesPerConversation: 1000,
        toolExecutions: 5000,
        artifactStorage: '100GB',
        modelAccess: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3-sonnet', 'claude-3-opus'],
        supportLevel: 'priority',
        customTools: true,
        apiAccess: true,
        webhooks: 25,
        analytics: 'advanced',
        collaboration: true,
        customBranding: true,
        sso: false,
        priority: 'high'
      },
      limits: {
        users: 25,
        conversations: 500,
        messagesPerMonth: 25000,
        toolExecutions: 5000,
        storageBytes: 100 * 1024 * 1024 * 1024, // 100GB
        apiCalls: 25000,
        webhooks: 25
      },
      isActive: true,
      isFeatured: true,
      trialDays: 14,
      sortOrder: 3,
      stripeProductId: 'prod_professional',
      stripePriceMonthlyId: 'price_professional_monthly',
      stripePriceYearlyId: 'price_professional_yearly'
    },
    {
      name: 'Business',
      slug: 'business',
      description: 'Comprehensive solution for larger organizations',
      priceMonthly: 9999, // $99.99
      priceYearly: 95999, // $959.99 (20% discount)
      currency: 'USD',
      features: {
        conversations: 2000,
        messagesPerConversation: -1, // unlimited
        toolExecutions: 20000,
        artifactStorage: '500GB',
        modelAccess: 'all',
        supportLevel: 'priority',
        customTools: true,
        apiAccess: true,
        webhooks: 100,
        analytics: 'advanced',
        collaboration: true,
        customBranding: true,
        sso: true,
        priority: 'high'
      },
      limits: {
        users: 100,
        conversations: 2000,
        messagesPerMonth: 100000,
        toolExecutions: 20000,
        storageBytes: 500 * 1024 * 1024 * 1024, // 500GB
        apiCalls: 100000,
        webhooks: 100
      },
      isActive: true,
      isFeatured: false,
      trialDays: 30,
      sortOrder: 4,
      stripeProductId: 'prod_business',
      stripePriceMonthlyId: 'price_business_monthly',
      stripePriceYearlyId: 'price_business_yearly'
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'Custom solutions for enterprise organizations',
      priceMonthly: 24999, // $249.99
      priceYearly: 239999, // $2399.99 (20% discount)
      currency: 'USD',
      features: {
        conversations: -1, // unlimited
        messagesPerConversation: -1, // unlimited
        toolExecutions: -1, // unlimited
        artifactStorage: 'unlimited',
        modelAccess: 'all',
        supportLevel: 'dedicated',
        customTools: true,
        apiAccess: true,
        webhooks: -1, // unlimited
        analytics: 'enterprise',
        collaboration: true,
        customBranding: true,
        sso: true,
        priority: 'highest',
        onPremise: true,
        customIntegrations: true,
        dedicatedInfrastructure: true,
        sla: '99.9%'
      },
      limits: {
        users: -1, // unlimited
        conversations: -1, // unlimited
        messagesPerMonth: -1, // unlimited
        toolExecutions: -1, // unlimited
        storageBytes: -1, // unlimited
        apiCalls: -1, // unlimited
        webhooks: -1 // unlimited
      },
      isActive: true,
      isFeatured: false,
      trialDays: 30,
      sortOrder: 5,
      stripeProductId: 'prod_enterprise',
      stripePriceMonthlyId: 'price_enterprise_monthly',
      stripePriceYearlyId: 'price_enterprise_yearly'
    }
  ];

  const createdPlans = [];

  for (const planData of pricingPlans) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: {
        slug: planData.slug
      },
      update: {
        name: planData.name,
        description: planData.description,
        priceMonthlyents: planData.priceMonthly,
        priceYearlyCents: planData.priceYearly,
        currency: planData.currency,
        features: planData.features,
        limits: planData.limits,
        isActive: planData.isActive,
        isFeatured: planData.isFeatured,
        trialDays: planData.trialDays,
        sortOrder: planData.sortOrder,
        stripeProductId: planData.stripeProductId,
        stripePriceMonthlyId: planData.stripePriceMonthlyId,
        stripePriceYearlyId: planData.stripePriceYearlyId,
        metadata: {
          updated: new Date().toISOString(),
          version: '1.0'
        }
      },
      create: {
        name: planData.name,
        slug: planData.slug,
        description: planData.description,
        priceMonthlyents: planData.priceMonthly,
        priceYearlyCents: planData.priceYearly,
        currency: planData.currency,
        features: planData.features,
        limits: planData.limits,
        isActive: planData.isActive,
        isFeatured: planData.isFeatured,
        trialDays: planData.trialDays,
        sortOrder: planData.sortOrder,
        stripeProductId: planData.stripeProductId,
        stripePriceMonthlyId: planData.stripePriceMonthlyId,
        stripePriceYearlyId: planData.stripePriceYearlyId,
        metadata: {
          created: new Date().toISOString(),
          version: '1.0'
        }
      }
    });

    createdPlans.push(plan);
  }

  // Assign free plan to existing default tenant
  const defaultTenant = await prisma.tenant.findFirst({
    where: { slug: 'penny' }
  });

  const freePlan = createdPlans.find(p => p.slug === 'free');

  if (defaultTenant && freePlan) {
    const existingSubscription = await prisma.subscription.findUnique({
      where: { tenantId: defaultTenant.id }
    });

    if (!existingSubscription) {
      await prisma.subscription.create({
        data: {
          tenantId: defaultTenant.id,
          planId: freePlan.id,
          status: 'active',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          priceCents: 0,
          currency: 'USD',
          usageBasedBilling: false,
          usageLimits: freePlan.limits,
          metadata: {
            plan: freePlan.slug,
            assignedAt: new Date().toISOString()
          }
        }
      });

      console.log(`✅ Assigned free plan to default tenant`);
    }
  }

  // Create addon products
  const addons = [
    {
      name: 'Extra Storage',
      slug: 'extra-storage',
      description: 'Additional 100GB of artifact storage',
      priceMonthly: 999, // $9.99
      priceYearly: 9599, // $95.99
      features: {
        storageGB: 100
      },
      limits: {
        storageBytes: 100 * 1024 * 1024 * 1024 // 100GB
      }
    },
    {
      name: 'Premium Models',
      slug: 'premium-models',
      description: 'Access to latest GPT-4 and Claude models',
      priceMonthly: 1999, // $19.99
      priceYearly: 19199, // $191.99
      features: {
        models: ['gpt-4-turbo', 'claude-3-opus', 'gemini-pro']
      }
    },
    {
      name: 'Advanced Analytics',
      slug: 'advanced-analytics',
      description: 'Detailed usage analytics and reporting',
      priceMonthly: 1499, // $14.99
      priceYearly: 14399, // $143.99
      features: {
        analytics: 'advanced',
        reports: true,
        dashboards: true
      }
    }
  ];

  for (const addon of addons) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: addon.slug },
      update: addon,
      create: {
        ...addon,
        isActive: true,
        sortOrder: 10,
        metadata: {
          type: 'addon',
          created: new Date().toISOString()
        }
      }
    });
  }

  console.log(`✅ Created/updated ${createdPlans.length} pricing plans`);
  console.log(`🎁 Created ${addons.length} addon products`);
  console.log('💎 Plan pricing summary:');

  for (const plan of createdPlans) {
    const monthlyPrice = plan.priceMonthlyents / 100;
    const yearlyPrice = plan.priceYearlyCents / 100;
    const yearlyDiscount = plan.priceMonthlyents > 0 
      ? Math.round((1 - (yearlyPrice / 12) / monthlyPrice) * 100) 
      : 0;

    console.log(`   ${plan.name}: $${monthlyPrice}/month, $${yearlyPrice}/year${yearlyDiscount > 0 ? ` (${yearlyDiscount}% discount)` : ''}`);
  }

  return createdPlans;
}

if (require.main === module) {
  seedPricingPlans()
    .then(() => {
      console.log('Pricing plans seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding pricing plans:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}