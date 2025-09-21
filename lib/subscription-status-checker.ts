/**
 * Subscription Status Checker
 * Handles subscription status validation and cleanup tasks
 * This service can be run as a cron job or scheduled task
 */

import { createClient } from './supabase/server';
import { subscriptionService } from './subscription-service';
import { notificationService } from './notification-service';

export class SubscriptionStatusChecker {
  /**
   * Check for expired subscriptions and downgrade to free plan
   */
  async checkExpiredSubscriptions(): Promise<void> {
    try {
      console.log('Checking for expired subscriptions...');
      
      const supabase = await createClient();
      const now = new Date().toISOString();
      
      // Find subscriptions that should have expired but are still marked as active
      const { data: expiredSubscriptions, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans!inner(name)
        `)
        .eq('status', 'active')
        .lt('current_period_end', now);

      if (error) {
        console.error('Error fetching expired subscriptions:', error);
        return;
      }

      if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
        console.log('No expired subscriptions found');
        return;
      }

      console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);

      for (const subscription of expiredSubscriptions) {
        try {
          // Update subscription status to expired
          await supabase
            .from('user_subscriptions')
            .update({
              status: 'expired',
              updated_at: now
            })
            .eq('id', subscription.id);

          // Create free plan subscription
          await subscriptionService.createFreeSubscription(subscription.user_id);

          // Send notification
          await notificationService.notifySubscriptionExpired(
            subscription.user_id,
            subscription.subscription_plans.name
          );

          console.log(`Processed expired subscription for user ${subscription.user_id}`);
        } catch (error) {
          console.error(`Error processing expired subscription ${subscription.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in checkExpiredSubscriptions:', error);
    }
  }

  /**
   * Check for subscriptions that should be cancelled at period end
   */
  async checkCancelledSubscriptions(): Promise<void> {
    try {
      console.log('Checking for subscriptions to cancel at period end...');
      
      const supabase = await createClient();
      const now = new Date().toISOString();
      
      // Find subscriptions that are cancelled but still active
      const { data: cancelledSubscriptions, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans!inner(name)
        `)
        .eq('status', 'cancelled')
        .eq('cancel_at_period_end', true)
        .lt('current_period_end', now);

      if (error) {
        console.error('Error fetching cancelled subscriptions:', error);
        return;
      }

      if (!cancelledSubscriptions || cancelledSubscriptions.length === 0) {
        console.log('No subscriptions to cancel at period end');
        return;
      }

      console.log(`Found ${cancelledSubscriptions.length} subscriptions to cancel at period end`);

      for (const subscription of cancelledSubscriptions) {
        try {
          // Update subscription status to expired
          await supabase
            .from('user_subscriptions')
            .update({
              status: 'expired',
              updated_at: now
            })
            .eq('id', subscription.id);

          // Create free plan subscription
          await subscriptionService.createFreeSubscription(subscription.user_id);

          console.log(`Processed cancelled subscription for user ${subscription.user_id}`);
        } catch (error) {
          console.error(`Error processing cancelled subscription ${subscription.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in checkCancelledSubscriptions:', error);
    }
  }

  /**
   * Check for past due subscriptions and send reminders
   */
  async checkPastDueSubscriptions(): Promise<void> {
    try {
      console.log('Checking for past due subscriptions...');
      
      const supabase = await createClient();
      const now = new Date().toISOString();
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      
      // Find subscriptions that are past due for more than 3 days
      const { data: pastDueSubscriptions, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans!inner(name)
        `)
        .eq('status', 'past_due')
        .lt('updated_at', threeDaysAgo);

      if (error) {
        console.error('Error fetching past due subscriptions:', error);
        return;
      }

      if (!pastDueSubscriptions || pastDueSubscriptions.length === 0) {
        console.log('No past due subscriptions found');
        return;
      }

      console.log(`Found ${pastDueSubscriptions.length} past due subscriptions`);

      for (const subscription of pastDueSubscriptions) {
        try {
          // Send additional payment failure notification
          await notificationService.notifyPaymentFailed(
            subscription.user_id,
            subscription.subscription_plans.name
          );

          console.log(`Sent reminder for past due subscription ${subscription.id}`);
        } catch (error) {
          console.error(`Error sending reminder for subscription ${subscription.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in checkPastDueSubscriptions:', error);
    }
  }

  /**
   * Run all subscription status checks
   */
  async runAllChecks(): Promise<void> {
    console.log('Running subscription status checks...');
    
    await Promise.all([
      this.checkExpiredSubscriptions(),
      this.checkCancelledSubscriptions(),
      this.checkPastDueSubscriptions()
    ]);
    
    console.log('Subscription status checks completed');
  }

  /**
   * Clean up old notifications (optional maintenance task)
   */
  async cleanupOldNotifications(): Promise<void> {
    try {
      console.log('Cleaning up old notifications...');
      
      const supabase = await createClient();
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('user_notifications')
        .delete()
        .eq('read', true)
        .lt('created_at', ninetyDaysAgo);

      if (error) {
        console.error('Error cleaning up old notifications:', error);
      } else {
        console.log('Old notifications cleaned up successfully');
      }
    } catch (error) {
      console.error('Error in cleanupOldNotifications:', error);
    }
  }
}

export const subscriptionStatusChecker = new SubscriptionStatusChecker();
