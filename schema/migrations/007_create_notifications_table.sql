-- Migration: Create user notifications table
-- Description: Creates table for storing user notifications about subscription status changes
-- Requirements: 5.2, 5.3

-- Create user_notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(500),
  action_text VARCHAR(100),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_notification_type CHECK (
    type IN ('subscription_expired', 'payment_failed', 'payment_recovered', 'subscription_cancelled', 'subscription_resumed')
  ),
  CONSTRAINT valid_priority CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  )
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON public.user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON public.user_notifications(read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON public.user_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_priority ON public.user_notifications(priority);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread ON public.user_notifications(user_id, read, created_at);

-- Add RLS policies
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: System can insert notifications for any user
CREATE POLICY "System can insert notifications" ON public.user_notifications
  FOR INSERT WITH CHECK (true);

-- Create function to clean up old notifications (optional)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  -- Delete notifications older than 90 days that have been read
  DELETE FROM public.user_notifications 
  WHERE read = true 
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_notifications_updated_at
  BEFORE UPDATE ON public.user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_user_notifications_updated_at();
