# Database Migrations for LemonSqueezy Payment Integration

This directory contains SQL migration files to set up the subscription management system for the LemonSqueezy payment integration.

## Migration Files

1. **001_create_subscription_tables.sql** - Creates the core subscription tables
   - `subscription_plans` - Stores plan definitions and limits
   - `user_subscriptions` - Tracks user subscription status
   - `usage_tracking` - Monitors user usage against plan limits
   - `webhook_events` - Logs webhook events for audit

2. **002_create_indexes.sql** - Creates performance indexes for optimal query performance

3. **003_create_functions.sql** - Creates utility functions for subscription and usage management
   - `get_user_subscription_with_plan()` - Get user subscription with plan details
   - `can_user_perform_action()` - Check if user can perform action based on limits
   - `increment_usage_count()` - Increment usage counters
   - `get_user_usage_stats()` - Get usage statistics with percentages
   - `reset_user_usage()` - Reset usage counters (for monthly reset)
   - `upsert_user_subscription()` - Create or update subscriptions

4. **004_create_triggers.sql** - Creates triggers for automatic updates and validation

5. **005_seed_subscription_plans.sql** - Seeds initial subscription plans (Free, Starter, Pro, Pro Plus)

6. **006_create_rls_policies.sql** - Creates Row Level Security policies for secure data access

## How to Run Migrations

### Option 1: Using Supabase Dashboard
1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy and paste each migration file content in order (001 through 006)
4. Execute each migration

### Option 2: Using Supabase CLI (if available)
```bash
# Run all migrations in order
supabase db reset
# Then run each migration file
```

### Option 3: Using psql (if you have direct database access)
```bash
# Connect to your database and run
\i schema/migrations/run_migrations.sql
```

## Subscription Plans

The system includes four default subscription plans:

| Plan | Price/Month | Memory Limit | File Limit |
|------|-------------|--------------|------------|
| Free | $0.00 | 20 | 2 |
| Starter | $9.99 | 100 | 10 |
| Pro | $19.99 | 500 | 50 |
| Pro Plus | $39.99 | 2000 | 200 |

## Database Functions Usage

### Check if user can perform action
```sql
SELECT can_user_perform_action('user-uuid', 'memory'); -- Returns boolean
SELECT can_user_perform_action('user-uuid', 'file');   -- Returns boolean
```

### Increment usage count
```sql
SELECT increment_usage_count('user-uuid', 'memory'); -- Returns boolean (success)
SELECT increment_usage_count('user-uuid', 'file');   -- Returns boolean (success)
```

### Get user usage statistics
```sql
SELECT * FROM get_user_usage_stats('user-uuid');
```

### Get user subscription with plan details
```sql
SELECT * FROM get_user_subscription_with_plan('user-uuid');
```

## Security

- Row Level Security (RLS) is enabled on all tables
- Users can only access their own subscription and usage data
- Service role has full access for webhook processing
- Subscription plans are publicly readable for active plans only

## Notes

- All tables use UUID primary keys for security
- Timestamps are automatically managed with triggers
- Usage tracking includes percentage calculations
- Webhook events support retry logic with error tracking
- Foreign key constraints ensure data integrity