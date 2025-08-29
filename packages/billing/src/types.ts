import { z } from 'zod';
import Decimal from 'decimal.js';

// Subscription Plans
export enum PlanType {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export enum PlanBillingInterval {
  MONTHLY = 'month',
  YEARLY = 'year'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired'
}

// Usage Types
export enum UsageType {
  MESSAGES = 'messages',
  TOKENS = 'tokens',
  STORAGE = 'storage',
  USERS = 'users',
  API_CALLS = 'api_calls',
  TOOLS = 'tools',
  ARTIFACTS = 'artifacts'
}

export interface UsageLimit {
  type: UsageType;
  limit: number;
  overage_rate?: Decimal;
  soft_limit?: number;
  hard_limit?: number;
}

export interface PlanFeatures {
  max_users: number;
  max_conversations: number;
  max_messages_per_month: number;
  max_tokens_per_month: number;
  max_storage_gb: number;
  max_api_calls_per_month: number;
  max_tools_per_month: number;
  max_artifacts_per_month: number;
  custom_tools: boolean;
  priority_support: boolean;
  sso: boolean;
  audit_logs: boolean;
  white_labeling: boolean;
  api_access: boolean;
  advanced_analytics: boolean;
  custom_integrations: boolean;
}

export interface Plan {
  id: string;
  name: string;
  type: PlanType;
  description: string;
  price_monthly: Decimal;
  price_yearly: Decimal;
  currency: string;
  stripe_price_id_monthly: string;
  stripe_price_id_yearly: string;
  features: PlanFeatures;
  usage_limits: UsageLimit[];
  trial_days: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Subscription
export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  current_period_start: Date;
  current_period_end: Date;
  trial_start?: Date;
  trial_end?: Date;
  canceled_at?: Date;
  ended_at?: Date;
  quantity: number;
  billing_interval: PlanBillingInterval;
  price: Decimal;
  currency: string;
  next_billing_date?: Date;
  grace_period_end?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Usage Tracking
export interface UsageRecord {
  id: string;
  tenant_id: string;
  subscription_id: string;
  usage_type: UsageType;
  quantity: number;
  period_start: Date;
  period_end: Date;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface UsageAggregate {
  tenant_id: string;
  usage_type: UsageType;
  period_start: Date;
  period_end: Date;
  total_quantity: number;
  billable_quantity: number;
  overage_quantity: number;
  limit: number;
}

// Billing
export interface Invoice {
  id: string;
  tenant_id: string;
  subscription_id: string;
  stripe_invoice_id: string;
  number: string;
  status: string;
  currency: string;
  subtotal: Decimal;
  tax: Decimal;
  discount: Decimal;
  total: Decimal;
  amount_paid: Decimal;
  amount_due: Decimal;
  period_start: Date;
  period_end: Date;
  due_date: Date;
  paid_at?: Date;
  pdf_url?: string;
  hosted_url?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_amount: Decimal;
  amount: Decimal;
  usage_type?: UsageType;
  period_start?: Date;
  period_end?: Date;
  metadata?: Record<string, any>;
}

// Payment Methods
export interface PaymentMethod {
  id: string;
  tenant_id: string;
  stripe_payment_method_id: string;
  type: string;
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

// Coupons and Discounts
export interface Coupon {
  id: string;
  stripe_coupon_id: string;
  name: string;
  percent_off?: number;
  amount_off?: Decimal;
  currency?: string;
  duration: 'forever' | 'once' | 'repeating';
  duration_in_months?: number;
  max_redemptions?: number;
  times_redeemed: number;
  valid_until?: Date;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Discount {
  id: string;
  tenant_id: string;
  subscription_id?: string;
  coupon_id: string;
  start: Date;
  end?: Date;
  created_at: Date;
}

// Billing Events
export enum BillingEventType {
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELED = 'subscription.canceled',
  SUBSCRIPTION_TRIAL_WILL_END = 'subscription.trial_will_end',
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAID = 'invoice.payment_succeeded',
  INVOICE_FAILED = 'invoice.payment_failed',
  PAYMENT_METHOD_ATTACHED = 'payment_method.attached',
  PAYMENT_METHOD_DETACHED = 'payment_method.detached',
  USAGE_THRESHOLD_EXCEEDED = 'usage.threshold_exceeded'
}

export interface BillingEvent {
  id: string;
  tenant_id: string;
  type: BillingEventType;
  data: Record<string, any>;
  stripe_event_id?: string;
  processed: boolean;
  created_at: Date;
  processed_at?: Date;
}

// API Request/Response Types
export const CreateSubscriptionSchema = z.object({
  plan_id: z.string(),
  billing_interval: z.nativeEnum(PlanBillingInterval),
  payment_method_id: z.string().optional(),
  coupon_code: z.string().optional(),
  trial_days: z.number().optional()
});

export const UpdateSubscriptionSchema = z.object({
  plan_id: z.string().optional(),
  billing_interval: z.nativeEnum(PlanBillingInterval).optional(),
  quantity: z.number().positive().optional(),
  prorate: z.boolean().default(true)
});

export const CreatePaymentMethodSchema = z.object({
  stripe_payment_method_id: z.string(),
  set_as_default: z.boolean().default(false)
});

export const CreateCouponSchema = z.object({
  name: z.string(),
  percent_off: z.number().min(1).max(100).optional(),
  amount_off: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  duration: z.enum(['forever', 'once', 'repeating']),
  duration_in_months: z.number().positive().optional(),
  max_redemptions: z.number().positive().optional(),
  valid_until: z.date().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export const RecordUsageSchema = z.object({
  usage_type: z.nativeEnum(UsageType),
  quantity: z.number().positive(),
  timestamp: z.date().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionSchema>;
export type UpdateSubscriptionRequest = z.infer<typeof UpdateSubscriptionSchema>;
export type CreatePaymentMethodRequest = z.infer<typeof CreatePaymentMethodSchema>;
export type CreateCouponRequest = z.infer<typeof CreateCouponSchema>;
export type RecordUsageRequest = z.infer<typeof RecordUsageSchema>;

// Service Options
export interface BillingServiceOptions {
  stripe_secret_key: string;
  webhook_secret: string;
  default_currency: string;
  trial_period_days: number;
  grace_period_days: number;
  usage_aggregation_interval: number; // minutes
  enable_proration: boolean;
  tax_calculation: boolean;
}

// Error Types
export class BillingError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

export class SubscriptionError extends BillingError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'SUBSCRIPTION_ERROR', 400, metadata);
    this.name = 'SubscriptionError';
  }
}

export class PaymentError extends BillingError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'PAYMENT_ERROR', 402, metadata);
    this.name = 'PaymentError';
  }
}

export class UsageLimitError extends BillingError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'USAGE_LIMIT_ERROR', 429, metadata);
    this.name = 'UsageLimitError';
  }
}

// Notifications
export interface BillingNotification {
  type: 'email' | 'webhook' | 'dashboard';
  recipient: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  scheduled_for?: Date;
}

// Analytics
export interface RevenueMetrics {
  total_revenue: Decimal;
  monthly_recurring_revenue: Decimal;
  annual_recurring_revenue: Decimal;
  average_revenue_per_user: Decimal;
  churn_rate: number;
  growth_rate: number;
  period_start: Date;
  period_end: Date;
}

export interface SubscriptionMetrics {
  total_subscriptions: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  canceled_subscriptions: number;
  new_subscriptions: number;
  churned_subscriptions: number;
  upgrade_count: number;
  downgrade_count: number;
  period_start: Date;
  period_end: Date;
}

export interface UsageMetrics {
  usage_type: UsageType;
  total_usage: number;
  average_usage_per_tenant: number;
  peak_usage: number;
  overage_count: number;
  period_start: Date;
  period_end: Date;
}