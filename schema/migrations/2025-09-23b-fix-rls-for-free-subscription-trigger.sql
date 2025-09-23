-- Ensure the trigger function runs with sufficient privileges and sets JWT claims

-- Recreate function with SECURITY DEFINER and safe search_path
CREATE OR REPLACE FUNCTION public.assign_free_subscription_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  previous_claims text;
BEGIN
  -- Propagate service_role and the new user's id into the session so RLS in downstream triggers is satisfied
  previous_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'role', 'service_role',
      'sub', NEW.id
    )::text,
    true
  );

  -- Try to migrate the user to the free plan; warn but do not block user creation on failure
  BEGIN
    PERFORM public.migrate_user_to_free_plan(NEW.id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'assign_free_subscription_on_signup failed for user %: %', NEW.id, SQLERRM;
  END;

  -- Restore previous claims if there were any
  PERFORM set_config('request.jwt.claims', COALESCE(previous_claims, ''), true);

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS assign_free_subscription_on_signup ON auth.users;
CREATE TRIGGER assign_free_subscription_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_free_subscription_on_signup();

-- Also harden migrate_user_to_free_plan to run with definer privileges and safe search_path
ALTER FUNCTION public.migrate_user_to_free_plan(uuid)
OWNER TO postgres;
ALTER FUNCTION public.migrate_user_to_free_plan(uuid)
SET search_path = public, pg_temp;
-- Some Postgres installations may not retain SECURITY DEFINER in dumps; enforce here
CREATE OR REPLACE FUNCTION public.migrate_user_to_free_plan(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    free_plan_id UUID;
    user_exists BOOLEAN;
    subscription_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO user_exists;
    IF NOT user_exists THEN
        RAISE WARNING 'User % does not exist', p_user_id;
        RETURN FALSE;
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.user_subscriptions WHERE user_id = p_user_id) INTO subscription_exists;
    IF subscription_exists THEN
        RAISE WARNING 'User % already has a subscription', p_user_id;
        RETURN FALSE;
    END IF;

    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE slug = 'free';
    IF free_plan_id IS NULL THEN
        RAISE EXCEPTION 'Free plan not found';
    END IF;

    INSERT INTO public.user_subscriptions (
        user_id, plan_id, status, cancel_at_period_end, created_at, updated_at
    ) VALUES (
        p_user_id, free_plan_id, 'active', false, NOW(), NOW()
    );

    -- usage_tracking is handled by its own trigger, but keep a safety net
    INSERT INTO public.usage_tracking (user_id, memory_count, file_count)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Successfully migrated user % to free plan', p_user_id;
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to migrate user %: %', p_user_id, SQLERRM;
        RETURN FALSE;
END;
$$;


