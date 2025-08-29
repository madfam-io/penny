import Decimal from 'decimal.js';
import { Plan, PlanType, PlanBillingInterval, UsageType, UsageLimit, PlanFeatures } from './types';

export const DEFAULT_PLANS: Omit<Plan, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Free',
    type: PlanType.FREE,
    description: 'Perfect for getting started with PENNY',
    price_monthly: new Decimal(0),
    price_yearly: new Decimal(0),
    currency: 'usd',
    stripe_price_id_monthly: '',
    stripe_price_id_yearly: '',
    trial_days: 0,
    is_active: true,
    features: {
      max_users: 3,
      max_conversations: 10,
      max_messages_per_month: 100,
      max_tokens_per_month: 10000,
      max_storage_gb: 1,
      max_api_calls_per_month: 100,
      max_tools_per_month: 50,
      max_artifacts_per_month: 10,
      custom_tools: false,
      priority_support: false,
      sso: false,
      audit_logs: false,
      white_labeling: false,
      api_access: false,
      advanced_analytics: false,
      custom_integrations: false
    },
    usage_limits: [
      {
        type: UsageType.USERS,
        limit: 3,
        hard_limit: 3
      },
      {
        type: UsageType.MESSAGES,
        limit: 100,
        overage_rate: new Decimal(0.01),
        soft_limit: 80,
        hard_limit: 150
      },
      {
        type: UsageType.TOKENS,
        limit: 10000,
        overage_rate: new Decimal(0.001),
        soft_limit: 8000,
        hard_limit: 15000
      },
      {
        type: UsageType.STORAGE,
        limit: 1073741824, // 1GB in bytes
        overage_rate: new Decimal(0.10),
        soft_limit: 858993459, // 0.8GB
        hard_limit: 1610612736 // 1.5GB
      },
      {
        type: UsageType.API_CALLS,
        limit: 100,
        overage_rate: new Decimal(0.001),
        soft_limit: 80,
        hard_limit: 150
      },
      {
        type: UsageType.TOOLS,
        limit: 50,
        overage_rate: new Decimal(0.02),
        soft_limit: 40,
        hard_limit: 75
      },
      {
        type: UsageType.ARTIFACTS,
        limit: 10,
        overage_rate: new Decimal(0.05),
        soft_limit: 8,
        hard_limit: 15
      }
    ]
  },
  {
    name: 'Pro',
    type: PlanType.PRO,
    description: 'For growing teams and businesses',
    price_monthly: new Decimal(29),
    price_yearly: new Decimal(290),
    currency: 'usd',
    stripe_price_id_monthly: 'price_pro_monthly',
    stripe_price_id_yearly: 'price_pro_yearly',
    trial_days: 14,
    is_active: true,
    features: {
      max_users: 25,
      max_conversations: 500,
      max_messages_per_month: 10000,
      max_tokens_per_month: 1000000,
      max_storage_gb: 50,
      max_api_calls_per_month: 10000,
      max_tools_per_month: 5000,
      max_artifacts_per_month: 1000,
      custom_tools: true,
      priority_support: true,
      sso: false,
      audit_logs: true,
      white_labeling: false,
      api_access: true,
      advanced_analytics: true,
      custom_integrations: true
    },
    usage_limits: [
      {
        type: UsageType.USERS,
        limit: 25,
        overage_rate: new Decimal(5.00),
        soft_limit: 20,
        hard_limit: 50
      },
      {
        type: UsageType.MESSAGES,
        limit: 10000,
        overage_rate: new Decimal(0.005),
        soft_limit: 8000,
        hard_limit: 15000
      },
      {
        type: UsageType.TOKENS,
        limit: 1000000,
        overage_rate: new Decimal(0.0005),
        soft_limit: 800000,
        hard_limit: 1500000
      },
      {
        type: UsageType.STORAGE,
        limit: 53687091200, // 50GB in bytes
        overage_rate: new Decimal(0.05),
        soft_limit: 42949672960, // 40GB
        hard_limit: 80530636800 // 75GB
      },
      {
        type: UsageType.API_CALLS,
        limit: 10000,
        overage_rate: new Decimal(0.0005),
        soft_limit: 8000,
        hard_limit: 15000
      },
      {
        type: UsageType.TOOLS,
        limit: 5000,
        overage_rate: new Decimal(0.01),
        soft_limit: 4000,
        hard_limit: 7500
      },
      {
        type: UsageType.ARTIFACTS,
        limit: 1000,
        overage_rate: new Decimal(0.02),
        soft_limit: 800,
        hard_limit: 1500
      }
    ]
  },
  {
    name: 'Enterprise',
    type: PlanType.ENTERPRISE,
    description: 'For large organizations with advanced needs',
    price_monthly: new Decimal(199),
    price_yearly: new Decimal(1990),
    currency: 'usd',
    stripe_price_id_monthly: 'price_enterprise_monthly',
    stripe_price_id_yearly: 'price_enterprise_yearly',
    trial_days: 30,
    is_active: true,
    features: {
      max_users: -1, // Unlimited
      max_conversations: -1, // Unlimited
      max_messages_per_month: 100000,
      max_tokens_per_month: 10000000,
      max_storage_gb: 500,
      max_api_calls_per_month: 100000,
      max_tools_per_month: 50000,
      max_artifacts_per_month: 10000,
      custom_tools: true,
      priority_support: true,
      sso: true,
      audit_logs: true,
      white_labeling: true,
      api_access: true,
      advanced_analytics: true,
      custom_integrations: true
    },
    usage_limits: [
      {
        type: UsageType.USERS,
        limit: -1, // Unlimited base, charged per seat
        overage_rate: new Decimal(3.00) // Per additional user
      },
      {
        type: UsageType.MESSAGES,
        limit: 100000,
        overage_rate: new Decimal(0.002),
        soft_limit: 80000
      },
      {
        type: UsageType.TOKENS,
        limit: 10000000,
        overage_rate: new Decimal(0.0002),
        soft_limit: 8000000
      },
      {
        type: UsageType.STORAGE,
        limit: 536870912000, // 500GB in bytes
        overage_rate: new Decimal(0.02),
        soft_limit: 429496729600 // 400GB
      },
      {
        type: UsageType.API_CALLS,
        limit: 100000,
        overage_rate: new Decimal(0.0002),
        soft_limit: 80000
      },
      {
        type: UsageType.TOOLS,
        limit: 50000,
        overage_rate: new Decimal(0.005),
        soft_limit: 40000
      },
      {
        type: UsageType.ARTIFACTS,
        limit: 10000,
        overage_rate: new Decimal(0.01),
        soft_limit: 8000
      }
    ]
  }
];

export class PlanService {
  private plans: Map<string, Plan> = new Map();

  constructor(customPlans?: Plan[]) {
    // Initialize with default plans or custom plans
    const plansToUse = customPlans || DEFAULT_PLANS.map(plan => ({
      ...plan,
      id: plan.type,
      created_at: new Date(),
      updated_at: new Date()
    }));

    plansToUse.forEach(plan => {
      this.plans.set(plan.id, plan);
    });
  }

  /**
   * Get all available plans
   */
  getPlans(): Plan[] {
    return Array.from(this.plans.values()).filter(plan => plan.is_active);
  }

  /**
   * Get a specific plan by ID
   */
  getPlan(planId: string): Plan | null {
    return this.plans.get(planId) || null;
  }

  /**
   * Get plan by type
   */
  getPlanByType(type: PlanType): Plan | null {
    return Array.from(this.plans.values()).find(plan => plan.type === type) || null;
  }

  /**
   * Calculate monthly cost for a plan with specific quantity
   */
  calculateMonthlyCost(planId: string, quantity: number = 1, interval: PlanBillingInterval = PlanBillingInterval.MONTHLY): Decimal {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    const basePrice = interval === PlanBillingInterval.YEARLY 
      ? plan.price_yearly.div(12) 
      : plan.price_monthly;

    return basePrice.mul(quantity);
  }

  /**
   * Calculate yearly cost for a plan with specific quantity
   */
  calculateYearlyCost(planId: string, quantity: number = 1): Decimal {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    return plan.price_yearly.mul(quantity);
  }

  /**
   * Get usage limit for a specific usage type and plan
   */
  getUsageLimit(planId: string, usageType: UsageType): UsageLimit | null {
    const plan = this.getPlan(planId);
    if (!plan) {
      return null;
    }

    return plan.usage_limits.find(limit => limit.type === usageType) || null;
  }

  /**
   * Check if a plan supports a specific feature
   */
  hasFeature(planId: string, feature: keyof PlanFeatures): boolean {
    const plan = this.getPlan(planId);
    if (!plan) {
      return false;
    }

    return !!plan.features[feature];
  }

  /**
   * Get recommended plan upgrade path
   */
  getUpgradePath(currentPlanId: string): Plan[] {
    const currentPlan = this.getPlan(currentPlanId);
    if (!currentPlan) {
      return [];
    }

    const allPlans = this.getPlans();
    const currentIndex = this.getPlanIndex(currentPlan.type);
    
    return allPlans.filter(plan => {
      const planIndex = this.getPlanIndex(plan.type);
      return planIndex > currentIndex;
    }).sort((a, b) => this.getPlanIndex(a.type) - this.getPlanIndex(b.type));
  }

  /**
   * Get recommended plan downgrade options
   */
  getDowngradePath(currentPlanId: string): Plan[] {
    const currentPlan = this.getPlan(currentPlanId);
    if (!currentPlan) {
      return [];
    }

    const allPlans = this.getPlans();
    const currentIndex = this.getPlanIndex(currentPlan.type);
    
    return allPlans.filter(plan => {
      const planIndex = this.getPlanIndex(plan.type);
      return planIndex < currentIndex;
    }).sort((a, b) => this.getPlanIndex(b.type) - this.getPlanIndex(a.type));
  }

  /**
   * Compare two plans
   */
  comparePlans(planId1: string, planId2: string): {
    cheaper: string | null;
    more_features: string | null;
    feature_differences: Record<string, { plan1: any; plan2: any }>;
  } {
    const plan1 = this.getPlan(planId1);
    const plan2 = this.getPlan(planId2);

    if (!plan1 || !plan2) {
      throw new Error('One or both plans not found');
    }

    const result = {
      cheaper: null as string | null,
      more_features: null as string | null,
      feature_differences: {} as Record<string, { plan1: any; plan2: any }>
    };

    // Compare prices (monthly)
    if (plan1.price_monthly.lessThan(plan2.price_monthly)) {
      result.cheaper = plan1.id;
    } else if (plan2.price_monthly.lessThan(plan1.price_monthly)) {
      result.cheaper = plan2.id;
    }

    // Compare features
    let plan1FeatureCount = 0;
    let plan2FeatureCount = 0;

    for (const [key, value] of Object.entries(plan1.features)) {
      const plan2Value = plan2.features[key as keyof PlanFeatures];
      
      if (value !== plan2Value) {
        result.feature_differences[key] = {
          plan1: value,
          plan2: plan2Value
        };
      }

      // Count boolean features and numeric advantages
      if (typeof value === 'boolean' && value) plan1FeatureCount++;
      if (typeof plan2Value === 'boolean' && plan2Value) plan2FeatureCount++;
      
      if (typeof value === 'number' && typeof plan2Value === 'number') {
        if (value > plan2Value || value === -1) plan1FeatureCount++;
        if (plan2Value > value || plan2Value === -1) plan2FeatureCount++;
      }
    }

    if (plan1FeatureCount > plan2FeatureCount) {
      result.more_features = plan1.id;
    } else if (plan2FeatureCount > plan1FeatureCount) {
      result.more_features = plan2.id;
    }

    return result;
  }

  /**
   * Get savings when switching from monthly to yearly billing
   */
  getYearlySavings(planId: string): { amount: Decimal; percentage: number } {
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    const monthlyTotal = plan.price_monthly.mul(12);
    const yearlyPrice = plan.price_yearly;
    const savings = monthlyTotal.minus(yearlyPrice);
    const percentage = savings.div(monthlyTotal).mul(100).toNumber();

    return {
      amount: savings,
      percentage
    };
  }

  private getPlanIndex(type: PlanType): number {
    const order = [PlanType.FREE, PlanType.PRO, PlanType.ENTERPRISE];
    return order.indexOf(type);
  }

  /**
   * Add or update a plan
   */
  addPlan(plan: Plan): void {
    this.plans.set(plan.id, plan);
  }

  /**
   * Remove a plan
   */
  removePlan(planId: string): boolean {
    return this.plans.delete(planId);
  }

  /**
   * Get plan suitable for usage requirements
   */
  getRecommendedPlan(requirements: Partial<PlanFeatures>): Plan | null {
    const plans = this.getPlans().sort((a, b) => this.getPlanIndex(a.type) - this.getPlanIndex(b.type));

    for (const plan of plans) {
      let suitable = true;

      for (const [key, requiredValue] of Object.entries(requirements)) {
        const planValue = plan.features[key as keyof PlanFeatures];

        if (typeof requiredValue === 'boolean' && requiredValue && !planValue) {
          suitable = false;
          break;
        }

        if (typeof requiredValue === 'number' && typeof planValue === 'number') {
          if (planValue !== -1 && planValue < requiredValue) {
            suitable = false;
            break;
          }
        }
      }

      if (suitable) {
        return plan;
      }
    }

    return null;
  }
}