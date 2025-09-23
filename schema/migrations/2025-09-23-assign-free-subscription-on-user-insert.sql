-- Automatically assign the "free" subscription to users upon signup

-- Idempotent function creation
CREATE OR REPLACE FUNCTION public.assign_free_subscription_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to migrate the user to the free plan; warn but do not block user creation on failure
  BEGIN
    PERFORM public.migrate_user_to_free_plan(NEW.id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'assign_free_subscription_on_signup failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Recreate trigger idempotently
DROP TRIGGER IF EXISTS assign_free_subscription_on_signup ON auth.users;
CREATE TRIGGER assign_free_subscription_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_free_subscription_on_signup();


