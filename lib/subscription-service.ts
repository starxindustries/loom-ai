import { createClient } from './supabase/server';
import { LemonSqueezyClient } from './lemonsqueezy-client';
import { errorHandlingService, ErrorType, ErrorSeverity } from './error-handling-service';
import { loggingService } from './logging-service';
import {
  SubscriptionServiceInterface,
  CheckoutSessionRequest,
  CheckoutSession,
  SubscriptionStatus,
  UserSubscription,
  SubscriptionPlan,
  LemonSqueezyCheckoutSession,
  LemonSqueezySubscription,
  SubscriptionPlanRow,
  UserSubscriptionRow
} from '../types/subscription';

export class SubscriptionService implements SubscriptionServiceInterface {
  private lemonSqueezyClient: LemonSqueezyClient;

  constructor() {
    this.lemonSqueezyClient = new LemonSqueezyClient();
  }

  /**
   * Create a checkout session with LemonSqueezy
   */
  async createCheckoutSession(request: CheckoutSessionRequest): Promise<CheckoutSession> {
    const startTime = Date.now();
    
    try {
      await loggingService.logSystemEvent(
        'checkout_initiated',
        `Creating checkout session for plan ${request.planId}`,
        { userId: request.userId, planId: request.planId }
      );

      // Get the plan details to find the LemonSqueezy variant ID
      const plan = await this.getPlanById(request.planId);
      if (!plan || !plan.lemonsqueezyVariantId) {
        const errorId = await errorHandlingService.logError(
          ErrorType.VALIDATION_ERROR,
          'Plan not found or missing LemonSqueezy variant ID',
          { userId: request.userId, planId: request.planId },
          ErrorSeverity.HIGH
        );
        throw new Error(`Plan not found or missing LemonSqueezy variant ID (Error ID: ${errorId})`);
      }

      // Create checkout session with LemonSqueezy client
      const result = await this.lemonSqueezyClient.createCheckout(plan, request);
      
      const duration = Date.now() - startTime;
      
      await loggingService.logPaymentEvent(
        'initiated',
        'checkout_session',
        request.userId,
        plan.priceMonthly,
        'USD',
        `Checkout session created successfully in ${duration}ms`,
        { userId: request.userId, planId: request.planId, duration }
      );
      
      return {
        id: result.data.id,
        url: result.data.attributes.url,
        expiresAt: result.data.attributes.expires_at ? new Date(result.data.attributes.expires_at) : undefined
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const errorId = await errorHandlingService.logError(
        ErrorType.SUBSCRIPTION_CREATION_FAILED,
        error,
        {
          userId: request.userId,
          planId: request.planId,
          duration,
        },
        ErrorSeverity.HIGH
      );

      await loggingService.logPaymentEvent(
        'failed',
        'checkout_session',
        request.userId,
        undefined,
        undefined,
        `Checkout session creation failed: ${errorMessage} (Error ID: ${errorId})`,
        { userId: request.userId, planId: request.planId, errorId, duration }
      );

      throw new Error(`Failed to create checkout session: ${errorMessage} (Error ID: ${errorId})`);
    }
  }

  /**
   * Update subscription status in the database
   */
  async updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus): Promise<void> {
    try {
      // Use service client inside webhook/background flows
      const { createServiceClient } = await import('./supabase/service');
      const supabase = createServiceClient();
      
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('lemonsqueezy_subscription_id', subscriptionId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating subscription status:', error);
      throw new Error(`Failed to update subscription status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current subscription for a user
   */
  async getCurrentSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const { createServiceClient } = await import('./supabase/service');
      const supabase = createServiceClient();
      
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return this.mapRowToUserSubscription(data);
    } catch (error) {
      console.error('Error getting current subscription:', error);
      throw new Error(`Failed to get current subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      // Cancel with LemonSqueezy client
      await this.lemonSqueezyClient.cancelSubscription(subscriptionId);

      // Update local database
      await this.updateSubscriptionStatus(subscriptionId, 'cancelled');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Change subscription plan
   */
  async changePlan(userId: string, newPlanId: string): Promise<void> {
    try {
      const currentSubscription = await this.getCurrentSubscription(userId);
      if (!currentSubscription || !currentSubscription.lemonsqueezySubscriptionId) {
        throw new Error('No active subscription found');
      }

      const newPlan = await this.getPlanById(newPlanId);
      if (!newPlan || !newPlan.lemonsqueezyVariantId) {
        throw new Error('New plan not found or missing LemonSqueezy variant ID');
      }

      // Update subscription with LemonSqueezy client
      await this.lemonSqueezyClient.updateSubscription(
        currentSubscription.lemonsqueezySubscriptionId,
        newPlan.lemonsqueezyVariantId
      );

      // Update local database
      const supabase = await createClient();
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ 
          plan_id: newPlanId,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSubscription.id);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      throw new Error(`Failed to change plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get subscription details from LemonSqueezy
   */
  async getSubscriptionFromLemonSqueezy(subscriptionId: string): Promise<LemonSqueezySubscription> {
    try {
      return await this.lemonSqueezyClient.getSubscription(subscriptionId);
    } catch (error) {
      console.error('Error getting subscription from LemonSqueezy:', error);
      throw new Error(`Failed to get subscription from LemonSqueezy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create or update subscription from webhook data
   */
  async upsertSubscriptionFromWebhook(webhookData: any): Promise<void> {
    try {
      const { createServiceClient } = await import('./supabase/service');
      const supabase = createServiceClient();
      const subscriptionData = webhookData.data;
      
      // Extract custom data to get user_id and plan_id
      const customData = webhookData.meta?.custom_data || {};
      const userId = customData.user_id;
      
      if (!userId) {
        throw new Error('User ID not found in webhook data');
      }

      // Find plan by LemonSqueezy variant ID
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('lemonsqueezy_variant_id', subscriptionData.attributes.variant_id.toString())
        .single();

      if (planError || !planData) {
        throw new Error('Plan not found for variant ID');
      }

      const subscriptionRecord = {
        user_id: userId,
        plan_id: planData.id,
        lemonsqueezy_subscription_id: subscriptionData.id,
        status: this.mapLemonSqueezyStatus(subscriptionData.attributes.status),
        current_period_start: subscriptionData.attributes.created_at,
        current_period_end: subscriptionData.attributes.renews_at,
        cancel_at_period_end: subscriptionData.attributes.cancelled || false,
        updated_at: new Date().toISOString()
      };

      // Upsert subscription
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert(subscriptionRecord, {
          onConflict: 'lemonsqueezy_subscription_id'
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error upserting subscription from webhook:', error);
      throw new Error(`Failed to upsert subscription from webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available subscription plans
   */
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    try {
      const { createServiceClient } = await import('./supabase/service');
      const supabase = createServiceClient();
      
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data.map(this.mapRowToSubscriptionPlan);
    } catch (error) {
      console.error('Error getting available plans:', error);
      throw new Error(`Failed to get available plans: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a free subscription for a user (used when subscription expires)
   */
  async createFreeSubscription(userId: string): Promise<void> {
    try {
      const supabase = await createClient();
      
      // Get the free plan
      const { data: freePlan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('slug', 'free')
        .single();

      if (planError || !freePlan) {
        throw new Error('Free plan not found');
      }

      // Create free subscription
      const subscriptionRecord = {
        user_id: userId,
        plan_id: freePlan.id,
        status: 'active',
        cancel_at_period_end: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('user_subscriptions')
        .insert(subscriptionRecord);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error creating free subscription:', error);
      throw new Error(`Failed to create free subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get plan by ID
   */
  private async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return this.mapRowToSubscriptionPlan(data);
    } catch (error) {
      console.error('Error getting plan by ID:', error);
      return null;
    }
  }

  /**
   * Map LemonSqueezy status to our internal status
   */
  private mapLemonSqueezyStatus(lemonSqueezyStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      'active': 'active',
      'cancelled': 'cancelled',
      'expired': 'expired',
      'past_due': 'past_due',
      'trialing': 'trialing',
      'paused': 'paused'
    };

    return statusMap[lemonSqueezyStatus] || 'active';
  }

  /**
   * Map database row to SubscriptionPlan interface
   */
  private mapRowToSubscriptionPlan(row: SubscriptionPlanRow): SubscriptionPlan {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      priceMonthly: row.price_monthly,
      memoryLimit: row.memory_limit,
      fileLimit: row.file_limit,
      lemonsqueezyVariantId: row.lemonsqueezy_variant_id,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Map database row to UserSubscription interface
   */
  private mapRowToUserSubscription(row: UserSubscriptionRow): UserSubscription {
    return {
      id: row.id,
      userId: row.user_id,
      planId: row.plan_id,
      lemonsqueezySubscriptionId: row.lemonsqueezy_subscription_id,
      status: row.status as SubscriptionStatus,
      currentPeriodStart: row.current_period_start ? new Date(row.current_period_start) : undefined,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : undefined,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();