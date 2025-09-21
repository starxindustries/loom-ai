-- Migration Runner Script
-- Description: Executes all subscription-related migrations in order
-- Usage: Run this script against your Supabase database to set up the subscription system

-- Migration 001: Create subscription tables
\i 001_create_subscription_tables.sql

-- Migration 002: Create performance indexes
\i 002_create_indexes.sql

-- Migration 003: Create database functions
\i 003_create_functions.sql

-- Migration 004: Create triggers
\i 004_create_triggers.sql

-- Migration 005: Seed subscription plans
\i 005_seed_subscription_plans.sql

-- Migration 006: Create RLS policies
\i 006_create_rls_policies.sql

-- Verify migrations completed successfully
SELECT 'Subscription system migrations completed successfully!' as status;