-- Migration: Create Row Level Security (RLS) policies
-- Description: Implements RLS policies for secure access to subscription data
-- Requirements: 4.1, 4.3

-- Enable RLS on all subscription tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Subscription Plans Policies (public read access for active plans)
CREATE POLICY "subscription_plans_public_read" ON public.subscription_plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "subscription_plans_admin_all" ON public.subscription_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.email LIKE '%@admin.%'
        )
    );

-- User Subscriptions Policies (users can only access their own subscriptions)
CREATE POLICY "user_subscriptions_own_read" ON public.user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_subscriptions_own_update" ON public.user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_subscriptions_service_insert" ON public.user_subscriptions
    FOR INSERT WITH CHECK (true); -- Allow service role to insert

CREATE POLICY "user_subscriptions_service_update" ON public.user_subscriptions
    FOR UPDATE USING (
        -- Allow service role or user themselves
        auth.jwt() ->> 'role' = 'service_role' OR auth.uid() = user_id
    );

-- Usage Tracking Policies (users can only access their own usage)
CREATE POLICY "usage_tracking_own_read" ON public.usage_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "usage_tracking_own_update" ON public.usage_tracking
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usage_tracking_service_all" ON public.usage_tracking
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "usage_tracking_auto_insert" ON public.usage_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Webhook Events Policies (service role only)
CREATE POLICY "webhook_events_service_only" ON public.webhook_events
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT SELECT, UPDATE ON public.user_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.usage_tracking TO authenticated;

-- Grant permissions to service role for webhook processing
GRANT ALL ON public.subscription_plans TO service_role;
GRANT ALL ON public.user_subscriptions TO service_role;
GRANT ALL ON public.usage_tracking TO service_role;
GRANT ALL ON public.webhook_events TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_subscription_with_plan(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_user_perform_action(UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_usage_count(UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_usage_stats(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reset_user_usage(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_user_subscription(UUID, UUID, VARCHAR, VARCHAR, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO service_role;