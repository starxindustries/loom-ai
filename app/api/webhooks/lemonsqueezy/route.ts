import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { formatDate } from '@/lib/date-utils';
import { createClient } from '@/lib/supabase/server';
import { subscriptionService } from '@/lib/subscription-service';
import { notificationService } from '@/lib/notification-service';
import { errorHandlingService, ErrorType, ErrorSeverity, ErrorContext } from '@/lib/error-handling-service';
import { loggingService, LogLevel, LogCategory, LogContext } from '@/lib/logging-service';
import { 
  LemonSqueezyWebhookEvent, 
  SubscriptionEventType,
  WebhookEventRow 
} from '@/types/subscription';

/**
 * LemonSqueezy webhook handler
 * Processes subscription events and updates database accordingly
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();

  try {
    // Log webhook received
    await loggingService.logWebhookEvent(
      'webhook_received',
      requestId,
      'received',
      'Webhook event received from LemonSqueezy',
      {
        requestId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    );

    // Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get('x-signature');
    
    if (!signature) {
      const errorId = await errorHandlingService.logError(
        ErrorType.WEBHOOK_VERIFICATION_FAILED,
        'Missing webhook signature',
        { requestId },
        ErrorSeverity.HIGH
      );
      
      await loggingService.logWebhookEvent(
        'webhook_verification_failed',
        requestId,
        'failed',
        `Webhook verification failed: Missing signature (Error ID: ${errorId})`,
        { requestId, errorId }
      );

      return NextResponse.json(
        errorHandlingService.createApiErrorResponse(
          ErrorType.WEBHOOK_VERIFICATION_FAILED,
          'Missing webhook signature',
          { requestId }
        ),
        { status: 400 }
      );
    }

    // Verify webhook signature
    const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      const errorId = await errorHandlingService.logError(
        ErrorType.WEBHOOK_VERIFICATION_FAILED,
        'Missing webhook secret configuration',
        { requestId },
        ErrorSeverity.CRITICAL
      );

      await loggingService.logSystemEvent(
        'error',
        `Webhook configuration error: Missing LEMONSQUEEZY_WEBHOOK_SECRET (Error ID: ${errorId})`,
        { requestId, errorId }
      );

      return NextResponse.json(
        errorHandlingService.createApiErrorResponse(
          ErrorType.WEBHOOK_VERIFICATION_FAILED,
          'Webhook configuration error',
          { requestId }
        ),
        { status: 500 }
      );
    }

    if (!verifyWebhookSignature(body, signature, webhookSecret)) {
      const errorId = await errorHandlingService.logError(
        ErrorType.WEBHOOK_VERIFICATION_FAILED,
        'Invalid webhook signature',
        { requestId },
        ErrorSeverity.HIGH
      );

      await loggingService.logWebhookEvent(
        'webhook_verification_failed',
        requestId,
        'failed',
        `Webhook verification failed: Invalid signature (Error ID: ${errorId})`,
        { requestId, errorId }
      );

      return NextResponse.json(
        errorHandlingService.createApiErrorResponse(
          ErrorType.WEBHOOK_VERIFICATION_FAILED,
          'Invalid webhook signature',
          { requestId }
        ),
        { status: 401 }
      );
    }

    // Parse webhook payload
    let webhookEvent: LemonSqueezyWebhookEvent;
    try {
      webhookEvent = JSON.parse(body);
    } catch (error) {
      const errorId = await errorHandlingService.logError(
        ErrorType.WEBHOOK_PROCESSING_FAILED,
        `Invalid JSON payload: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { requestId },
        ErrorSeverity.MEDIUM
      );

      await loggingService.logWebhookEvent(
        'webhook_parsing_failed',
        requestId,
        'failed',
        `Webhook parsing failed: Invalid JSON (Error ID: ${errorId})`,
        { requestId, errorId }
      );

      return NextResponse.json(
        errorHandlingService.createApiErrorResponse(
          ErrorType.WEBHOOK_PROCESSING_FAILED,
          'Invalid JSON payload',
          { requestId }
        ),
        { status: 400 }
      );
    }

    const eventName = webhookEvent.meta.event_name;
    const subscriptionId = webhookEvent.data.attributes.identifier;
    const userId = webhookEvent.meta.custom_data?.user_id;

    // Log webhook processing start
    await loggingService.logWebhookEvent(
      eventName,
      requestId,
      'processing',
      `Processing webhook event: ${eventName}`,
      {
        requestId,
        webhookEventId: webhookEvent.data.id,
        subscriptionId,
        userId,
      }
    );

    // Log webhook event to database
    const supabase = await createClient();
    const webhookRecord: Omit<WebhookEventRow, 'id' | 'created_at'> = {
      event_type: webhookEvent.meta.event_name,
      lemonsqueezy_event_id: webhookEvent.data.id,
      payload: webhookEvent,
      processed: false
    };

    const { data: loggedEvent, error: logError } = await supabase
      .from('webhook_events')
      .insert(webhookRecord)
      .select()
      .single();

    if (logError) {
      const errorId = await errorHandlingService.logError(
        ErrorType.DATABASE_QUERY_FAILED,
        `Failed to log webhook event: ${logError.message}`,
        { requestId, subscriptionId, userId },
        ErrorSeverity.MEDIUM
      );

      await loggingService.logSystemEvent(
        'error',
        `Failed to log webhook event to database (Error ID: ${errorId})`,
        { requestId, errorId, subscriptionId, userId }
      );
      // Continue processing even if logging fails
    }

    // Process the webhook event
    try {
      await processWebhookEvent(webhookEvent);
      
      // Mark event as processed
      if (loggedEvent) {
        await supabase
          .from('webhook_events')
          .update({ processed: true })
          .eq('id', loggedEvent.id);
      }

      const duration = Date.now() - startTime;

      // Log successful processing
      await loggingService.logWebhookEvent(
        eventName,
        requestId,
        'completed',
        `Webhook event processed successfully in ${duration}ms`,
        {
          requestId,
          webhookEventId: webhookEvent.data.id,
          subscriptionId,
          userId,
          duration,
        }
      );

      return NextResponse.json({ success: true });
    } catch (processingError) {
      const duration = Date.now() - startTime;
      const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown error';
      
      const errorId = await errorHandlingService.logError(
        ErrorType.WEBHOOK_PROCESSING_FAILED,
        processingError,
        {
          requestId,
          subscriptionId,
          userId,
          duration,
        },
        ErrorSeverity.HIGH
      );

      // Log webhook processing failure
      await loggingService.logWebhookEvent(
        eventName,
        requestId,
        'failed',
        `Webhook processing failed: ${errorMessage} (Error ID: ${errorId})`,
        {
          requestId,
          webhookEventId: webhookEvent.data.id,
          subscriptionId,
          userId,
          errorId,
          duration,
        }
      );
      
      // Update event with error information
      if (loggedEvent) {
        await supabase
          .from('webhook_events')
          .update({ 
            processed: false,
            error_message: errorMessage,
            retry_count: (loggedEvent.retry_count || 0) + 1
          })
          .eq('id', loggedEvent.id);
      }

      // Return 500 to trigger LemonSqueezy retry
      return NextResponse.json(
        errorHandlingService.createApiErrorResponse(
          ErrorType.WEBHOOK_PROCESSING_FAILED,
          processingError,
          { requestId, duration }
        ),
        { status: 500 }
      );
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log critical error
    const errorId = await errorHandlingService.logError(
      ErrorType.WEBHOOK_PROCESSING_FAILED,
      error,
      {
        requestId,
        duration,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
      ErrorSeverity.CRITICAL
    );

    // Log webhook handler failure
    await loggingService.logWebhookEvent(
      'webhook_handler_failed',
      requestId,
      'failed',
      `Webhook handler failed: ${errorMessage} (Error ID: ${errorId})`,
      {
        requestId,
        errorId,
        duration,
      }
    );

    return NextResponse.json(
      errorHandlingService.createApiErrorResponse(
        ErrorType.WEBHOOK_PROCESSING_FAILED,
        error,
        { requestId, duration }
      ),
      { status: 500 }
    );
  }
}

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const expectedSignature = hmac.digest('hex');
    
    // LemonSqueezy sends signature in format "sha256=<hash>"
    const receivedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Process webhook event based on event type
 */
async function processWebhookEvent(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  const eventType = webhookEvent.meta.event_name as SubscriptionEventType;
  
  console.log(`Processing webhook event: ${eventType}`);

  switch (eventType) {
    case 'subscription_created':
      await handleSubscriptionCreated(webhookEvent);
      break;
      
    case 'subscription_updated':
      await handleSubscriptionUpdated(webhookEvent);
      break;
      
    case 'subscription_cancelled':
      await handleSubscriptionCancelled(webhookEvent);
      break;
      
    case 'subscription_resumed':
      await handleSubscriptionResumed(webhookEvent);
      break;
      
    case 'subscription_expired':
      await handleSubscriptionExpired(webhookEvent);
      break;
      
    case 'subscription_paused':
      await handleSubscriptionPaused(webhookEvent);
      break;
      
    case 'subscription_unpaused':
      await handleSubscriptionUnpaused(webhookEvent);
      break;
      
    case 'subscription_payment_failed':
      await handleSubscriptionPaymentFailed(webhookEvent);
      break;
      
    case 'subscription_payment_success':
      await handleSubscriptionPaymentSuccess(webhookEvent);
      break;
      
    case 'subscription_payment_recovered':
      await handleSubscriptionPaymentRecovered(webhookEvent);
      break;
      
    default:
      console.log(`Unhandled webhook event type: ${eventType}`);
      // Don't throw error for unhandled events
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  console.log('Processing subscription_created event');
  await subscriptionService.upsertSubscriptionFromWebhook(webhookEvent);
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  console.log('Processing subscription_updated event');
  await subscriptionService.upsertSubscriptionFromWebhook(webhookEvent);
}

/**
 * Handle subscription cancelled event
 */
async function handleSubscriptionCancelled(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  console.log('Processing subscription_cancelled event');
  
  const subscriptionId = webhookEvent.data.id;
  const attributes = webhookEvent.data.attributes;
  
  const supabase = await createClient();
  
  // Get current subscription details before updating
  const { data: currentSubscription } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      subscription_plans!inner(name)
    `)
    .eq('lemonsqueezy_subscription_id', subscriptionId)
    .single();

  // Update subscription status to cancelled
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      current_period_end: attributes.ends_at || attributes.renews_at,
      updated_at: new Date().toISOString()
    })
    .eq('lemonsqueezy_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update cancelled subscription: ${error.message}`);
  }

  // Send notification to user
  if (currentSubscription?.subscription_plans?.name) {
    const endDate = formatDate(attributes.ends_at || attributes.renews_at);
    await notificationService.notifySubscriptionCancelled(
      currentSubscription.user_id,
      currentSubscription.subscription_plans.name,
      endDate
    );
  }
}

/**
 * Handle subscription resumed event
 */
async function handleSubscriptionResumed(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  console.log('Processing subscription_resumed event');
  
  const subscriptionId = webhookEvent.data.id;
  const attributes = webhookEvent.data.attributes;
  
  const supabase = await createClient();
  
  // Get current subscription details before updating
  const { data: currentSubscription } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      subscription_plans!inner(name)
    `)
    .eq('lemonsqueezy_subscription_id', subscriptionId)
    .single();

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: attributes.renews_at,
      updated_at: new Date().toISOString()
    })
    .eq('lemonsqueezy_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update resumed subscription: ${error.message}`);
  }

  // Send notification to user
  if (currentSubscription?.subscription_plans?.name) {
    await notificationService.notifySubscriptionResumed(
      currentSubscription.user_id,
      currentSubscription.subscription_plans.name
    );
  }
}

/**
 * Handle subscription expired event
 */
async function handleSubscriptionExpired(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  const subscriptionId = webhookEvent.data.id;
  const customData = webhookEvent.meta.custom_data || {};
  const userId = customData.user_id;
  
  if (!userId) {
    const errorId = await errorHandlingService.logError(
      ErrorType.WEBHOOK_PROCESSING_FAILED,
      'User ID not found in webhook data for subscription_expired event',
      { subscriptionId, webhookEventId: webhookEvent.data.id },
      ErrorSeverity.HIGH
    );
    throw new Error(`User ID not found in webhook data (Error ID: ${errorId})`);
  }

  await loggingService.logSubscriptionChange(
    'expired',
    subscriptionId,
    userId,
    'unknown', // We'll get the actual plan ID from the database
    `Subscription expired for user ${userId}`,
    { subscriptionId, userId }
  );

  const supabase = await createClient();
  
  // Get current subscription details before updating
  const { data: currentSubscription, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      subscription_plans!inner(name, id)
    `)
    .eq('lemonsqueezy_subscription_id', subscriptionId)
    .single();

  if (fetchError) {
    const errorId = await errorHandlingService.logError(
      ErrorType.DATABASE_QUERY_FAILED,
      `Failed to fetch current subscription: ${fetchError.message}`,
      { subscriptionId, userId },
      ErrorSeverity.HIGH
    );
    throw new Error(`Failed to fetch current subscription (Error ID: ${errorId})`);
  }

  // Update subscription status to expired
  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString()
    })
    .eq('lemonsqueezy_subscription_id', subscriptionId);

  if (subscriptionError) {
    const errorId = await errorHandlingService.logError(
      ErrorType.SUBSCRIPTION_UPDATE_FAILED,
      `Failed to update expired subscription: ${subscriptionError.message}`,
      { subscriptionId, userId },
      ErrorSeverity.HIGH
    );
    throw new Error(`Failed to update expired subscription (Error ID: ${errorId})`);
  }

  // Create free plan subscription for the user
  try {
    await subscriptionService.createFreeSubscription(userId);
    
    await loggingService.logSubscriptionChange(
      'created',
      'free_subscription',
      userId,
      'free',
      `Created free plan subscription for user ${userId} after expiration`,
      { subscriptionId, userId, previousPlan: currentSubscription?.subscription_plans?.name }
    );
  } catch (error) {
    const errorId = await errorHandlingService.logError(
      ErrorType.SUBSCRIPTION_CREATION_FAILED,
      `Failed to create free subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { subscriptionId, userId },
      ErrorSeverity.HIGH
    );
    throw new Error(`Failed to create free subscription (Error ID: ${errorId})`);
  }

  // Send notification to user
  if (currentSubscription?.subscription_plans?.name) {
    try {
      await notificationService.notifySubscriptionExpired(
        userId, 
        currentSubscription.subscription_plans.name
      );
      
      await loggingService.logSystemEvent(
        'notification_sent',
        `Sent subscription expired notification to user ${userId}`,
        { userId, subscriptionId, planName: currentSubscription.subscription_plans.name } as LogContext
      );
    } catch (error) {
      const errorId = await errorHandlingService.logError(
        ErrorType.NOTIFICATION_SERVICE_ERROR,
        `Failed to send subscription expired notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { subscriptionId, userId },
        ErrorSeverity.MEDIUM
      );
      
      // Don't throw here as the main operation succeeded
      console.error(`Failed to send notification (Error ID: ${errorId}):`, error);
    }
  }
}

/**
 * Handle subscription paused event
 */
async function handleSubscriptionPaused(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  console.log('Processing subscription_paused event');
  
  const subscriptionId = webhookEvent.data.id;
  
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString()
    })
    .eq('lemonsqueezy_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update paused subscription: ${error.message}`);
  }
}

/**
 * Handle subscription unpaused event
 */
async function handleSubscriptionUnpaused(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  console.log('Processing subscription_unpaused event');
  
  const subscriptionId = webhookEvent.data.id;
  const attributes = webhookEvent.data.attributes;
  
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      current_period_end: attributes.renews_at,
      updated_at: new Date().toISOString()
    })
    .eq('lemonsqueezy_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update unpaused subscription: ${error.message}`);
  }
}

/**
 * Handle subscription payment failed event
 */
async function handleSubscriptionPaymentFailed(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  console.log('Processing subscription_payment_failed event');
  
  const subscriptionId = webhookEvent.data.id;
  const attributes = webhookEvent.data.attributes;
  
  const supabase = await createClient();
  
  // Get current subscription details before updating
  const { data: currentSubscription } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      subscription_plans!inner(name)
    `)
    .eq('lemonsqueezy_subscription_id', subscriptionId)
    .single();

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('lemonsqueezy_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update payment failed subscription: ${error.message}`);
  }

  // Send notification to user
  if (currentSubscription?.subscription_plans?.name) {
    await notificationService.notifyPaymentFailed(
      currentSubscription.user_id,
      currentSubscription.subscription_plans.name,
      attributes.next_payment_retry_at
    );
  }
}

/**
 * Handle subscription payment success event
 */
async function handleSubscriptionPaymentSuccess(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  console.log('Processing subscription_payment_success event');
  
  const subscriptionId = webhookEvent.data.id;
  const attributes = webhookEvent.data.attributes;
  
  const supabase = await createClient();
  
  // Get current subscription details before updating
  const { data: currentSubscription } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      subscription_plans!inner(name)
    `)
    .eq('lemonsqueezy_subscription_id', subscriptionId)
    .single();

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      current_period_start: attributes.created_at,
      current_period_end: attributes.renews_at,
      updated_at: new Date().toISOString()
    })
    .eq('lemonsqueezy_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update payment success subscription: ${error.message}`);
  }

  // Send notification to user if this was a recovery from past_due status
  if (currentSubscription?.status === 'past_due' && currentSubscription?.subscription_plans?.name) {
    await notificationService.notifyPaymentRecovered(
      currentSubscription.user_id,
      currentSubscription.subscription_plans.name
    );
  }
}

/**
 * Handle subscription payment recovered event
 */
async function handleSubscriptionPaymentRecovered(webhookEvent: LemonSqueezyWebhookEvent): Promise<void> {
  console.log('Processing subscription_payment_recovered event');
  
  const subscriptionId = webhookEvent.data.id;
  const attributes = webhookEvent.data.attributes;
  
  const supabase = await createClient();
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      current_period_end: attributes.renews_at,
      updated_at: new Date().toISOString()
    })
    .eq('lemonsqueezy_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update payment recovered subscription: ${error.message}`);
  }
}