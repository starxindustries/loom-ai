-- Migration: User migration and usage tracking initialization
-- Description: Creates free subscriptions for existing users and initializes usage tracking
-- Requirements: 4.1, 4.2

-- First, ensure we have the free plan
INSERT INTO public.subscription_plans (name, slug, price_monthly, memory_limit, file_limit, lemonsqueezy_variant_id, is_active)
VALUES ('Free', 'free', 0.00, 20, 2, NULL, true)
ON CONFLICT (slug) DO NOTHING;

-- Get the free plan ID
DO $$
DECLARE
    free_plan_id UUID;
    user_record RECORD;
    user_count INTEGER := 0;
    subscription_count INTEGER := 0;
    usage_count INTEGER := 0;
BEGIN
    -- Get the free plan ID
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE slug = 'free';
    
    IF free_plan_id IS NULL THEN
        RAISE EXCEPTION 'Free plan not found. Please run the plan seeding migration first.';
    END IF;
    
    RAISE NOTICE 'Starting user migration with free plan ID: %', free_plan_id;
    
    -- Count existing users
    SELECT COUNT(*) INTO user_count FROM auth.users;
    RAISE NOTICE 'Found % existing users', user_count;
    
    -- Create free subscriptions for all existing users who don't have a subscription
    FOR user_record IN 
        SELECT u.id, u.email, u.created_at
        FROM auth.users u
        LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
        WHERE us.id IS NULL
    LOOP
        -- Create free subscription
        INSERT INTO public.user_subscriptions (
            user_id,
            plan_id,
            status,
            cancel_at_period_end,
            created_at,
            updated_at
        ) VALUES (
            user_record.id,
            free_plan_id,
            'active',
            false,
            user_record.created_at,
            NOW()
        );
        
        subscription_count := subscription_count + 1;
        
        -- Initialize usage tracking for the user
        INSERT INTO public.usage_tracking (
            user_id,
            memory_count,
            file_count,
            last_reset_at,
            created_at,
            updated_at
        ) VALUES (
            user_record.id,
            0,
            0,
            user_record.created_at,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            updated_at = NOW();
        
        usage_count := usage_count + 1;
        
        -- Log progress every 100 users
        IF subscription_count % 100 = 0 THEN
            RAISE NOTICE 'Processed % users...', subscription_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE '- Created % free subscriptions', subscription_count;
    RAISE NOTICE '- Initialized % usage tracking records', usage_count;
    
    -- Update statistics
    UPDATE public.subscription_plans 
    SET updated_at = NOW() 
    WHERE id = free_plan_id;
    
END $$;

-- Create a function to migrate individual users (useful for new signups)
CREATE OR REPLACE FUNCTION migrate_user_to_free_plan(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    free_plan_id UUID;
    user_exists BOOLEAN;
    subscription_exists BOOLEAN;
BEGIN
    -- Check if user exists
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO user_exists;
    
    IF NOT user_exists THEN
        RAISE WARNING 'User % does not exist', p_user_id;
        RETURN FALSE;
    END IF;
    
    -- Check if user already has a subscription
    SELECT EXISTS(SELECT 1 FROM public.user_subscriptions WHERE user_id = p_user_id) INTO subscription_exists;
    
    IF subscription_exists THEN
        RAISE WARNING 'User % already has a subscription', p_user_id;
        RETURN FALSE;
    END IF;
    
    -- Get free plan ID
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE slug = 'free';
    
    IF free_plan_id IS NULL THEN
        RAISE EXCEPTION 'Free plan not found';
    END IF;
    
    -- Create free subscription
    INSERT INTO public.user_subscriptions (
        user_id,
        plan_id,
        status,
        cancel_at_period_end,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        free_plan_id,
        'active',
        false,
        NOW(),
        NOW()
    );
    
    -- Initialize usage tracking
    INSERT INTO public.usage_tracking (
        user_id,
        memory_count,
        file_count,
        last_reset_at,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        0,
        0,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        updated_at = NOW();
    
    RAISE NOTICE 'Successfully migrated user % to free plan', p_user_id;
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to migrate user %: %', p_user_id, SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get migration statistics
CREATE OR REPLACE FUNCTION get_migration_stats()
RETURNS TABLE (
    total_users INTEGER,
    users_with_subscriptions INTEGER,
    users_with_free_plan INTEGER,
    users_with_paid_plan INTEGER,
    users_without_subscription INTEGER,
    total_usage_records INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*)::INTEGER FROM auth.users) as total_users,
        (SELECT COUNT(*)::INTEGER FROM public.user_subscriptions) as users_with_subscriptions,
        (SELECT COUNT(*)::INTEGER 
         FROM public.user_subscriptions us
         JOIN public.subscription_plans sp ON us.plan_id = sp.id
         WHERE sp.slug = 'free') as users_with_free_plan,
        (SELECT COUNT(*)::INTEGER 
         FROM public.user_subscriptions us
         JOIN public.subscription_plans sp ON us.plan_id = sp.id
         WHERE sp.slug != 'free') as users_with_paid_plan,
        (SELECT COUNT(*)::INTEGER 
         FROM auth.users u
         LEFT JOIN public.user_subscriptions us ON u.id = us.user_id
         WHERE us.id IS NULL) as users_without_subscription,
        (SELECT COUNT(*)::INTEGER FROM public.usage_tracking) as total_usage_records;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to clean up orphaned usage records
CREATE OR REPLACE FUNCTION cleanup_orphaned_usage_records()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete usage records for users that no longer exist
    DELETE FROM public.usage_tracking 
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % orphaned usage records', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to reset usage for all users (useful for testing)
CREATE OR REPLACE FUNCTION reset_all_usage()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Reset usage counts for all users
    UPDATE public.usage_tracking 
    SET 
        memory_count = 0,
        file_count = 0,
        last_reset_at = NOW(),
        updated_at = NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Reset usage for % users', updated_count;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON public.user_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON public.usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_last_reset ON public.usage_tracking(last_reset_at);

-- Add comments
COMMENT ON FUNCTION migrate_user_to_free_plan(UUID) IS 'Migrates a single user to the free plan and initializes usage tracking';
COMMENT ON FUNCTION get_migration_stats() IS 'Returns statistics about user migration and subscription status';
COMMENT ON FUNCTION cleanup_orphaned_usage_records() IS 'Removes usage tracking records for deleted users';
COMMENT ON FUNCTION reset_all_usage() IS 'Resets usage counts for all users (useful for testing)';
