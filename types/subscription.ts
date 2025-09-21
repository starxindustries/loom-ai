// Subscription Plan Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  memoryLimit: number;
  fileLimit: number;
  lemonsqueezyVariantId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// User Subscription Types
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due' | 'trialing' | 'paused';

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  lemonsqueezySubscriptionId?: string;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Usage Tracking Types
export interface UsageStats {
  memoryCount: number;
  fileCount: number;
  memoryLimit: number;
  fileLimit: number;
  lastResetAt: Date;
}

export interface UsageTracking {
  id: string;
  userId: string;
  memoryCount: number;
  fileCount: number;
  lastResetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ResourceType = 'memory' | 'file';

// LemonSqueezy API Response Types
export interface LemonSqueezyCheckoutSession {
  data: {
    id: string;
    type: 'checkouts';
    attributes: {
      url: string;
      custom_price?: number;
      product_options?: {
        name?: string;
        description?: string;
        media?: string[];
        redirect_url?: string;
        receipt_button_text?: string;
        receipt_link_url?: string;
        receipt_thank_you_note?: string;
      };
      checkout_options?: {
        embed?: boolean;
        media?: boolean;
        logo?: boolean;
        desc?: boolean;
        discount?: boolean;
        dark?: boolean;
        subscription_preview?: boolean;
        button_color?: string;
      };
      checkout_data?: {
        email?: string;
        name?: string;
        billing_address?: Record<string, any>;
        tax_number?: string;
        discount_code?: string;
        custom?: Record<string, any>;
        variant_quantities?: Array<{
          variant_id: number;
          quantity: number;
        }>;
      };
      expires_at?: string;
      created_at: string;
      updated_at: string;
      test_mode: boolean;
    };
    relationships: {
      store: {
        links: {
          related: string;
          self: string;
        };
      };
      variant: {
        links: {
          related: string;
          self: string;
        };
      };
    };
    links: {
      self: string;
    };
  };
}

export interface LemonSqueezySubscription {
  data: {
    id: string;
    type: 'subscriptions';
    attributes: {
      store_id: number;
      customer_id: number;
      order_id: number;
      order_item_id: number;
      product_id: number;
      variant_id: number;
      product_name: string;
      variant_name: string;
      user_name: string;
      user_email: string;
      status: string;
      status_formatted: string;
      card_brand?: string;
      card_last_four?: string;
      pause?: any;
      cancelled: boolean;
      trial_ends_at?: string;
      billing_anchor: number;
      first_subscription_item?: {
        id: number;
        subscription_id: number;
        price_id: number;
        quantity: number;
        created_at: string;
        updated_at: string;
      };
      urls: {
        update_payment_method: string;
        customer_portal: string;
      };
      renews_at: string;
      ends_at?: string;
      created_at: string;
      updated_at: string;
      test_mode: boolean;
    };
  };
}

// Webhook Payload Types
export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: Record<string, any>;
  };
  data: {
    id: string;
    type: string;
    attributes: Record<string, any>;
    relationships?: Record<string, any>;
  };
}

export interface WebhookEvent {
  id: string;
  eventType: string;
  lemonsqueezyEventId?: string;
  payload: Record<string, any>;
  processed: boolean;
  createdAt: Date;
}

// Subscription Event Types
export type SubscriptionEventType = 
  | 'subscription_created'
  | 'subscription_updated' 
  | 'subscription_cancelled'
  | 'subscription_resumed'
  | 'subscription_expired'
  | 'subscription_paused'
  | 'subscription_unpaused'
  | 'subscription_payment_failed'
  | 'subscription_payment_success'
  | 'subscription_payment_recovered';

// API Error Types
export interface APIError {
  error: string;
  message: string;
  code: string;
  details?: any;
}

export interface SubscriptionError extends APIError {
  subscriptionId?: string;
  userId?: string;
}

// Checkout and Payment Types
export interface CheckoutSessionRequest {
  planId: string;
  userId: string;
  successUrl?: string;
  cancelUrl?: string;
  customData?: Record<string, any>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  expiresAt?: Date;
}

// Upgrade Prompt Types
export interface UpgradePrompt {
  title: string;
  message: string;
  currentUsage: number;
  limit: number;
  resourceType: ResourceType;
  suggestedPlans: SubscriptionPlan[];
}

// Plan Comparison Types
export interface PlanComparison {
  currentPlan: SubscriptionPlan;
  availablePlans: SubscriptionPlan[];
  usage: UsageStats;
}

// Billing Dashboard Types
export interface BillingDashboardData {
  currentPlan: SubscriptionPlan;
  subscription: UserSubscription;
  usage: UsageStats;
  availablePlans: SubscriptionPlan[];
  paymentMethod?: {
    brand: string;
    lastFour: string;
  };
  nextBillingDate?: Date;
}

// Service Interface Types
export interface SubscriptionServiceInterface {
  createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSession>;
  updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus): Promise<void>;
  getCurrentSubscription(userId: string): Promise<UserSubscription | null>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  changePlan(userId: string, newPlanId: string): Promise<void>;
}

export interface UsageTrackingServiceInterface {
  checkUsageLimit(userId: string, resourceType: ResourceType): Promise<boolean>;
  incrementUsage(userId: string, resourceType: ResourceType): Promise<void>;
  getCurrentUsage(userId: string): Promise<UsageStats>;
  resetUsage(userId: string): Promise<void>;
}

// Middleware Types
export interface PlanRestrictionResult {
  allowed: boolean;
  upgradePrompt?: UpgradePrompt;
}

// Database Row Types (matching Supabase schema)
export interface SubscriptionPlanRow {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  memory_limit: number;
  file_limit: number;
  lemonsqueezy_variant_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  lemonsqueezy_subscription_id?: string;
  status: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageTrackingRow {
  id: string;
  user_id: string;
  memory_count: number;
  file_count: number;
  last_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookEventRow {
  id: string;
  event_type: string;
  lemonsqueezy_event_id?: string;
  payload: Record<string, any>;
  processed: boolean;
  error_message?: string;
  retry_count?: number;
  created_at: string;
}