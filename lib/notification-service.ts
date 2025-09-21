/**
 * Notification Service
 * Handles user notifications for subscription status changes, payment failures, and other events
 */

import { createClient } from './supabase/server';
import { UserSubscription, SubscriptionPlan } from '@/types/subscription';

export interface NotificationData {
  userId: string;
  type: 'subscription_expired' | 'payment_failed' | 'payment_recovered' | 'subscription_cancelled' | 'subscription_resumed';
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export class NotificationService {
  /**
   * Send notification to user about subscription status change
   */
  async sendNotification(notification: NotificationData): Promise<void> {
    try {
      const supabase = await createClient();
      
      // Store notification in database for in-app display
      const { error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          action_url: notification.actionUrl,
          action_text: notification.actionText,
          priority: notification.priority,
          read: false,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error storing notification:', error);
        // Don't throw error - notifications are not critical
      }

      // In a real implementation, you would also send email notifications here
      // For now, we'll just log the notification
      console.log(`Notification sent to user ${notification.userId}:`, {
        type: notification.type,
        title: notification.title,
        priority: notification.priority
      });

    } catch (error) {
      console.error('Error sending notification:', error);
      // Don't throw error - notifications are not critical
    }
  }

  /**
   * Notify user about subscription expiration
   */
  async notifySubscriptionExpired(userId: string, planName: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'subscription_expired',
      title: 'Subscription Expired',
      message: `Your ${planName} subscription has expired. You've been moved to the free plan with limited features.`,
      actionUrl: '/protected/billing?tab=plans',
      actionText: 'Upgrade Plan',
      priority: 'high'
    });
  }

  /**
   * Notify user about payment failure
   */
  async notifyPaymentFailed(userId: string, planName: string, retryDate?: string): Promise<void> {
    const message = retryDate 
      ? `Your payment for ${planName} failed. We'll retry on ${retryDate}. Please update your payment method.`
      : `Your payment for ${planName} failed. Please update your payment method to avoid service interruption.`;

    await this.sendNotification({
      userId,
      type: 'payment_failed',
      title: 'Payment Failed',
      message,
      actionUrl: '/protected/billing?tab=payment',
      actionText: 'Update Payment Method',
      priority: 'urgent'
    });
  }

  /**
   * Notify user about payment recovery
   */
  async notifyPaymentRecovered(userId: string, planName: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'payment_recovered',
      title: 'Payment Successful',
      message: `Your payment for ${planName} was successful. Your subscription is now active.`,
      actionUrl: '/protected/billing',
      actionText: 'View Billing',
      priority: 'medium'
    });
  }

  /**
   * Notify user about subscription cancellation
   */
  async notifySubscriptionCancelled(userId: string, planName: string, endDate: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'subscription_cancelled',
      title: 'Subscription Cancelled',
      message: `Your ${planName} subscription has been cancelled. You'll retain access until ${endDate}.`,
      actionUrl: '/protected/billing?tab=plans',
      actionText: 'Reactivate Plan',
      priority: 'medium'
    });
  }

  /**
   * Notify user about subscription resumption
   */
  async notifySubscriptionResumed(userId: string, planName: string): Promise<void> {
    await this.sendNotification({
      userId,
      type: 'subscription_resumed',
      title: 'Subscription Reactivated',
      message: `Your ${planName} subscription has been reactivated. Welcome back!`,
      actionUrl: '/protected/billing',
      actionText: 'View Billing',
      priority: 'medium'
    });
  }

  /**
   * Get user's unread notifications
   */
  async getUserNotifications(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const supabase = await createClient();
      
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient();
      
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error marking notification as read:', error);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const supabase = await createClient();
      
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }
}

export const notificationService = new NotificationService();
