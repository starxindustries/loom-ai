-- Migration: Create subscription management tables
-- Description: Creates tables for subscription plans, user subscriptions, usage tracking, and webhook events
-- Requirements: 4.1, 4.3

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  memory_limit INTEGER NOT NULL,
  file_limit INTEGER NOT NULL,
  lemonsqueezy_variant_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT positive_price CHECK (price_monthly >= 0),
  CONSTRAINT positive_memory_limit CHECK (memory_limit >= 0),
  CONSTRAINT positive_file_limit CHECK (file_limit >= 0)
) TABLESPACE pg_default;

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  lemonsqueezy_subscription_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_subscription_status CHECK (
    status IN ('active', 'cancelled', 'expired', 'past_due', 'trialing', 'paused')
  ),
  CONSTRAINT valid_period_dates CHECK (
    current_period_start IS NULL OR current_period_end IS NULL OR 
    current_period_start <= current_period_end
  )
) TABLESPACE pg_default;

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_count INTEGER DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT positive_memory_count CHECK (memory_count >= 0),
  CONSTRAINT positive_file_count CHECK (file_count >= 0),
  CONSTRAINT unique_user_usage UNIQUE (user_id)
) TABLESPACE pg_default;

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  lemonsqueezy_event_id VARCHAR(255) UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT positive_retry_count CHECK (retry_count >= 0),
  CONSTRAINT max_retry_count CHECK (retry_count <= 5)
) TABLESPACE pg_default;

-- Add comments for documentation
COMMENT ON TABLE public.subscription_plans IS 'Stores subscription plan definitions and limits';
COMMENT ON TABLE public.user_subscriptions IS 'Tracks user subscription status and billing information';
COMMENT ON TABLE public.usage_tracking IS 'Monitors user usage against plan limits';
COMMENT ON TABLE public.webhook_events IS 'Logs webhook events from LemonSqueezy for audit and processing';

COMMENT ON COLUMN public.subscription_plans.lemonsqueezy_variant_id IS 'LemonSqueezy variant ID for payment processing';
COMMENT ON COLUMN public.user_subscriptions.lemonsqueezy_subscription_id IS 'LemonSqueezy subscription ID for webhook processing';
COMMENT ON COLUMN public.usage_tracking.last_reset_at IS 'Timestamp of last usage counter reset (monthly)';
COMMENT ON COLUMN public.webhook_events.retry_count IS 'Number of processing retry attempts';