-- Migration: Seed initial subscription plans
-- Description: Inserts the default subscription plans (Free, Starter, Pro, Pro Plus)
-- Requirements: 4.1, 4.2

-- Insert subscription plans
INSERT INTO public.subscription_plans (name, slug, price_monthly, memory_limit, file_limit, lemonsqueezy_variant_id, is_active)
VALUES 
    ('Free', 'free', 0.00, 20, 2, NULL, true),
    ('Starter', 'starter', 9.99, 100, 10, NULL, true),
    ('Pro', 'pro', 19.99, 500, 50, NULL, true),
    ('Pro Plus', 'pro-plus', 39.99, 2000, 200, NULL, true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price_monthly = EXCLUDED.price_monthly,
    memory_limit = EXCLUDED.memory_limit,
    file_limit = EXCLUDED.file_limit,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Add comments for plan descriptions
COMMENT ON TABLE public.subscription_plans IS 'Available subscription plans with usage limits and pricing';

-- Update comments for specific plans
UPDATE public.subscription_plans SET 
    updated_at = NOW()
WHERE slug IN ('free', 'starter', 'pro', 'pro-plus');