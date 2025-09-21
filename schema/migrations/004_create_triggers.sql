-- Migration: Create triggers for subscription tables
-- Description: Creates triggers for automatic timestamp updates and data validation
-- Requirements: 4.1, 4.3

-- Create triggers for updated_at columns
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at
    BEFORE UPDATE ON usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one active subscription per user
CREATE OR REPLACE FUNCTION ensure_single_active_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- If the new/updated subscription is active, deactivate others
    IF NEW.status = 'active' THEN
        UPDATE user_subscriptions 
        SET status = 'cancelled', updated_at = NOW()
        WHERE user_id = NEW.user_id 
        AND id != NEW.id 
        AND status = 'active';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure single active subscription
CREATE TRIGGER ensure_single_active_subscription_trigger
    AFTER INSERT OR UPDATE ON user_subscriptions
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION ensure_single_active_subscription();

-- Function to initialize usage tracking for new users
CREATE OR REPLACE FUNCTION initialize_user_usage_tracking()
RETURNS TRIGGER AS $$
BEGIN
    -- Create usage tracking record for new subscription
    INSERT INTO usage_tracking (user_id, memory_count, file_count)
    VALUES (NEW.user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to initialize usage tracking
CREATE TRIGGER initialize_usage_tracking_trigger
    AFTER INSERT ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_usage_tracking();

-- Function to validate subscription period dates
CREATE OR REPLACE FUNCTION validate_subscription_periods()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure period start is before period end
    IF NEW.current_period_start IS NOT NULL AND NEW.current_period_end IS NOT NULL THEN
        IF NEW.current_period_start >= NEW.current_period_end THEN
            RAISE EXCEPTION 'Subscription period start must be before period end';
        END IF;
    END IF;
    
    -- Ensure period end is not in the past for active subscriptions
    IF NEW.status = 'active' AND NEW.current_period_end IS NOT NULL THEN
        IF NEW.current_period_end < NOW() THEN
            RAISE EXCEPTION 'Active subscription cannot have period end in the past';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscription period validation
CREATE TRIGGER validate_subscription_periods_trigger
    BEFORE INSERT OR UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION validate_subscription_periods();

-- Function to log webhook processing attempts
CREATE OR REPLACE FUNCTION log_webhook_processing()
RETURNS TRIGGER AS $$
BEGIN
    -- Update processed_at timestamp when processed status changes to true
    IF NEW.processed = true AND (OLD.processed IS NULL OR OLD.processed = false) THEN
        NEW.processed_at = NOW();
    END IF;
    
    -- Increment retry count if processing failed
    IF NEW.processed = false AND NEW.error_message IS NOT NULL THEN
        IF OLD.retry_count IS NULL THEN
            NEW.retry_count = 1;
        ELSE
            NEW.retry_count = OLD.retry_count + 1;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for webhook processing logging
CREATE TRIGGER log_webhook_processing_trigger
    BEFORE UPDATE ON webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION log_webhook_processing();