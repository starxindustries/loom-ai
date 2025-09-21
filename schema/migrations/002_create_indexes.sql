-- Migration: Create performance indexes for subscription tables
-- Description: Adds indexes for optimal query performance on subscription-related tables
-- Requirements: 4.1, 4.3

-- Indexes for subscription_plans table
CREATE INDEX IF NOT EXISTS subscription_plans_slug_idx 
  ON public.subscription_plans USING btree (slug) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS subscription_plans_active_idx 
  ON public.subscription_plans USING btree (is_active) 
  WHERE is_active = true
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS subscription_plans_lemonsqueezy_variant_idx 
  ON public.subscription_plans USING btree (lemonsqueezy_variant_id) 
  WHERE lemonsqueezy_variant_id IS NOT NULL
  TABLESPACE pg_default;

-- Indexes for user_subscriptions table
CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx 
  ON public.user_subscriptions USING btree (user_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS user_subscriptions_plan_id_idx 
  ON public.user_subscriptions USING btree (plan_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx 
  ON public.user_subscriptions USING btree (status) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS user_subscriptions_lemonsqueezy_id_idx 
  ON public.user_subscriptions USING btree (lemonsqueezy_subscription_id) 
  WHERE lemonsqueezy_subscription_id IS NOT NULL
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS user_subscriptions_period_end_idx 
  ON public.user_subscriptions USING btree (current_period_end) 
  WHERE current_period_end IS NOT NULL
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS user_subscriptions_active_idx 
  ON public.user_subscriptions USING btree (user_id, status) 
  WHERE status = 'active'
  TABLESPACE pg_default;

-- Indexes for usage_tracking table
CREATE INDEX IF NOT EXISTS usage_tracking_user_id_idx 
  ON public.usage_tracking USING btree (user_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS usage_tracking_last_reset_idx 
  ON public.usage_tracking USING btree (last_reset_at) 
  TABLESPACE pg_default;

-- Indexes for webhook_events table
CREATE INDEX IF NOT EXISTS webhook_events_event_type_idx 
  ON public.webhook_events USING btree (event_type) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS webhook_events_processed_idx 
  ON public.webhook_events USING btree (processed) 
  WHERE processed = false
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS webhook_events_lemonsqueezy_id_idx 
  ON public.webhook_events USING btree (lemonsqueezy_event_id) 
  WHERE lemonsqueezy_event_id IS NOT NULL
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx 
  ON public.webhook_events USING btree (created_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS webhook_events_retry_idx 
  ON public.webhook_events USING btree (processed, retry_count) 
  WHERE processed = false AND retry_count < 5
  TABLESPACE pg_default;

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS user_subscriptions_user_status_period_idx 
  ON public.user_subscriptions USING btree (user_id, status, current_period_end) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS webhook_events_type_processed_created_idx 
  ON public.webhook_events USING btree (event_type, processed, created_at DESC) 
  TABLESPACE pg_default;