-- Migration: Create database functions for subscription and usage management
-- Description: Creates utility functions for usage tracking and subscription management
-- Requirements: 4.1, 4.3

-- Function to update updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get current user subscription with plan details
CREATE OR REPLACE FUNCTION get_user_subscription_with_plan(p_user_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    plan_id UUID,
    plan_name VARCHAR(50),
    plan_slug VARCHAR(50),
    memory_limit INTEGER,
    file_limit INTEGER,
    status VARCHAR(50),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.id,
        us.plan_id,
        sp.name,
        sp.slug,
        sp.memory_limit,
        sp.file_limit,
        us.status,
        us.current_period_start,
        us.current_period_end,
        us.cancel_at_period_end
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'trialing')
    ORDER BY us.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can perform action based on usage limits
CREATE OR REPLACE FUNCTION can_user_perform_action(
    p_user_id UUID,
    p_action_type VARCHAR(10) -- 'memory' or 'file'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_count INTEGER;
    v_limit INTEGER;
    v_subscription RECORD;
BEGIN
    -- Get user's current subscription and limits
    SELECT * INTO v_subscription 
    FROM get_user_subscription_with_plan(p_user_id);
    
    -- If no active subscription found, use free plan limits
    IF v_subscription IS NULL THEN
        IF p_action_type = 'memory' THEN
            v_limit := 20; -- Free plan memory limit
        ELSIF p_action_type = 'file' THEN
            v_limit := 2; -- Free plan file limit
        ELSE
            RETURN FALSE;
        END IF;
    ELSE
        IF p_action_type = 'memory' THEN
            v_limit := v_subscription.memory_limit;
        ELSIF p_action_type = 'file' THEN
            v_limit := v_subscription.file_limit;
        ELSE
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Get current usage count
    IF p_action_type = 'memory' THEN
        SELECT COALESCE(memory_count, 0) INTO v_current_count
        FROM usage_tracking
        WHERE user_id = p_user_id;
    ELSIF p_action_type = 'file' THEN
        SELECT COALESCE(file_count, 0) INTO v_current_count
        FROM usage_tracking
        WHERE user_id = p_user_id;
    END IF;
    
    -- If no usage record exists, assume 0 usage
    v_current_count := COALESCE(v_current_count, 0);
    
    -- Check if user is within limits
    RETURN v_current_count < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_usage_count(
    p_user_id UUID,
    p_action_type VARCHAR(10) -- 'memory' or 'file'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_can_perform BOOLEAN;
BEGIN
    -- Check if user can perform the action
    SELECT can_user_perform_action(p_user_id, p_action_type) INTO v_can_perform;
    
    IF NOT v_can_perform THEN
        RETURN FALSE;
    END IF;
    
    -- Insert or update usage tracking
    INSERT INTO usage_tracking (user_id, memory_count, file_count)
    VALUES (
        p_user_id,
        CASE WHEN p_action_type = 'memory' THEN 1 ELSE 0 END,
        CASE WHEN p_action_type = 'file' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id) DO UPDATE SET
        memory_count = CASE 
            WHEN p_action_type = 'memory' THEN usage_tracking.memory_count + 1 
            ELSE usage_tracking.memory_count 
        END,
        file_count = CASE 
            WHEN p_action_type = 'file' THEN usage_tracking.file_count + 1 
            ELSE usage_tracking.file_count 
        END,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user usage stats with limits
CREATE OR REPLACE FUNCTION get_user_usage_stats(p_user_id UUID)
RETURNS TABLE (
    memory_count INTEGER,
    file_count INTEGER,
    memory_limit INTEGER,
    file_limit INTEGER,
    memory_percentage DECIMAL(5,2),
    file_percentage DECIMAL(5,2),
    last_reset_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_subscription RECORD;
    v_usage RECORD;
BEGIN
    -- Get user's current subscription and limits
    SELECT * INTO v_subscription 
    FROM get_user_subscription_with_plan(p_user_id);
    
    -- Get current usage
    SELECT 
        COALESCE(ut.memory_count, 0) as memory_count,
        COALESCE(ut.file_count, 0) as file_count,
        COALESCE(ut.last_reset_at, NOW()) as last_reset_at
    INTO v_usage
    FROM usage_tracking ut
    WHERE ut.user_id = p_user_id;
    
    -- If no usage record, create default values
    IF v_usage IS NULL THEN
        v_usage.memory_count := 0;
        v_usage.file_count := 0;
        v_usage.last_reset_at := NOW();
    END IF;
    
    -- Set limits based on subscription or free plan
    IF v_subscription IS NULL THEN
        -- Free plan limits
        memory_limit := 20;
        file_limit := 2;
    ELSE
        memory_limit := v_subscription.memory_limit;
        file_limit := v_subscription.file_limit;
    END IF;
    
    -- Calculate usage
    memory_count := v_usage.memory_count;
    file_count := v_usage.file_count;
    last_reset_at := v_usage.last_reset_at;
    
    -- Calculate percentages
    memory_percentage := CASE 
        WHEN memory_limit > 0 THEN ROUND((memory_count::DECIMAL / memory_limit::DECIMAL) * 100, 2)
        ELSE 0 
    END;
    
    file_percentage := CASE 
        WHEN file_limit > 0 THEN ROUND((file_count::DECIMAL / file_limit::DECIMAL) * 100, 2)
        ELSE 0 
    END;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset usage counts (for monthly reset)
CREATE OR REPLACE FUNCTION reset_user_usage(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO usage_tracking (user_id, memory_count, file_count, last_reset_at)
    VALUES (p_user_id, 0, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        memory_count = 0,
        file_count = 0,
        last_reset_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create or update user subscription
CREATE OR REPLACE FUNCTION upsert_user_subscription(
    p_user_id UUID,
    p_plan_id UUID,
    p_lemonsqueezy_subscription_id VARCHAR(255),
    p_status VARCHAR(50),
    p_current_period_start TIMESTAMP WITH TIME ZONE,
    p_current_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS UUID AS $$
DECLARE
    v_subscription_id UUID;
BEGIN
    INSERT INTO user_subscriptions (
        user_id,
        plan_id,
        lemonsqueezy_subscription_id,
        status,
        current_period_start,
        current_period_end
    )
    VALUES (
        p_user_id,
        p_plan_id,
        p_lemonsqueezy_subscription_id,
        p_status,
        p_current_period_start,
        p_current_period_end
    )
    ON CONFLICT (lemonsqueezy_subscription_id) DO UPDATE SET
        plan_id = p_plan_id,
        status = p_status,
        current_period_start = p_current_period_start,
        current_period_end = p_current_period_end,
        updated_at = NOW()
    RETURNING id INTO v_subscription_id;
    
    RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;