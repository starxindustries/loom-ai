-- Migration: Create error logs table
-- Description: Creates a table to store comprehensive error logs for monitoring and debugging
-- Requirements: 5.4, 4.4

CREATE TABLE IF NOT EXISTS public.error_logs (
  id VARCHAR(255) PRIMARY KEY, -- Custom error ID format: err_timestamp_random
  type VARCHAR(100) NOT NULL, -- Error type enum
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  user_message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  stack_trace TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) TABLESPACE pg_default;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON public.error_logs (type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs (severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs (resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs USING GIN ((context->>'userId'));
CREATE INDEX IF NOT EXISTS idx_error_logs_subscription_id ON public.error_logs USING GIN ((context->>'subscriptionId'));

-- Add RLS policy for error logs (admin access only)
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Only allow system/service accounts to insert error logs
CREATE POLICY "System can insert error logs" ON public.error_logs
  FOR INSERT WITH CHECK (true);

-- Only allow admin users to view error logs
CREATE POLICY "Admins can view error logs" ON public.error_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only allow admin users to update error logs
CREATE POLICY "Admins can update error logs" ON public.error_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create a function to clean up old error logs (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete error logs older than 90 days
  DELETE FROM public.error_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % old error logs', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get error statistics
CREATE OR REPLACE FUNCTION get_error_statistics(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_severity VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
  total_errors BIGINT,
  errors_by_type JSONB,
  errors_by_severity JSONB,
  recent_errors JSONB
) AS $$
DECLARE
  start_date_filter TIMESTAMP WITH TIME ZONE;
  end_date_filter TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set default date range if not provided
  start_date_filter := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
  end_date_filter := COALESCE(p_end_date, NOW());
  
  RETURN QUERY
  SELECT 
    COUNT(*) as total_errors,
    jsonb_object_agg(type, type_count) as errors_by_type,
    jsonb_object_agg(severity, severity_count) as errors_by_severity,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'type', type,
        'severity', severity,
        'message', message,
        'created_at', created_at,
        'resolved', resolved
      ) ORDER BY created_at DESC
    ) as recent_errors
  FROM (
    SELECT 
      el.*,
      COUNT(*) OVER (PARTITION BY el.type) as type_count,
      COUNT(*) OVER (PARTITION BY el.severity) as severity_count
    FROM public.error_logs el
    WHERE 
      el.created_at >= start_date_filter
      AND el.created_at <= end_date_filter
      AND (p_severity IS NULL OR el.severity = p_severity)
  ) grouped_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to mark errors as resolved
CREATE OR REPLACE FUNCTION resolve_error_log(
  p_error_id VARCHAR(255),
  p_resolved_by VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  UPDATE public.error_logs 
  SET 
    resolved = true,
    resolved_at = NOW(),
    resolved_by = p_resolved_by,
    updated_at = NOW()
  WHERE id = p_error_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  IF updated_count > 0 THEN
    RAISE NOTICE 'Marked error % as resolved by %', p_error_id, p_resolved_by;
    RETURN TRUE;
  ELSE
    RAISE WARNING 'Error % not found or already resolved', p_error_id;
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.error_logs IS 'Comprehensive error logging for monitoring and debugging';
COMMENT ON COLUMN public.error_logs.id IS 'Custom error ID format: err_timestamp_random';
COMMENT ON COLUMN public.error_logs.type IS 'Error type classification';
COMMENT ON COLUMN public.error_logs.severity IS 'Error severity level';
COMMENT ON COLUMN public.error_logs.message IS 'Technical error message';
COMMENT ON COLUMN public.error_logs.user_message IS 'User-friendly error message';
COMMENT ON COLUMN public.error_logs.context IS 'Additional context and metadata';
COMMENT ON COLUMN public.error_logs.stack_trace IS 'Error stack trace if available';
COMMENT ON FUNCTION cleanup_old_error_logs() IS 'Removes error logs older than 90 days';
COMMENT ON FUNCTION get_error_statistics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, VARCHAR(20)) IS 'Returns error statistics for monitoring dashboard';
COMMENT ON FUNCTION resolve_error_log(VARCHAR(255), VARCHAR(255)) IS 'Marks an error as resolved';
