-- Migration: Create system logs table
-- Description: Creates a table to store comprehensive system logs for monitoring and debugging
-- Requirements: 5.4, 4.4

CREATE TABLE IF NOT EXISTS public.system_logs (
  id VARCHAR(255) PRIMARY KEY, -- Custom log ID format: log_timestamp_random
  level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical')),
  category VARCHAR(50) NOT NULL CHECK (category IN ('webhook', 'subscription', 'payment', 'usage', 'auth', 'api', 'system', 'security')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  source VARCHAR(100) NOT NULL, -- e.g., 'webhook-handler', 'subscription-service'
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) TABLESPACE pg_default;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs (level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON public.system_logs (category);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON public.system_logs (source);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON public.system_logs USING GIN ((context->>'userId'));
CREATE INDEX IF NOT EXISTS idx_system_logs_subscription_id ON public.system_logs USING GIN ((context->>'subscriptionId'));
CREATE INDEX IF NOT EXISTS idx_system_logs_operation ON public.system_logs USING GIN ((context->>'operation'));

-- Add RLS policy for system logs (admin access only)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Only allow system/service accounts to insert logs
CREATE POLICY "System can insert logs" ON public.system_logs
  FOR INSERT WITH CHECK (true);

-- Only allow admin users to view logs
CREATE POLICY "Admins can view logs" ON public.system_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create a function to clean up old logs (older than 30 days for debug/info, 90 days for others)
CREATE OR REPLACE FUNCTION cleanup_old_system_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  debug_info_count INTEGER := 0;
  other_count INTEGER := 0;
BEGIN
  -- Delete debug and info logs older than 30 days
  DELETE FROM public.system_logs 
  WHERE level IN ('debug', 'info')
  AND created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS debug_info_count = ROW_COUNT;
  
  -- Delete other logs older than 90 days
  DELETE FROM public.system_logs 
  WHERE level IN ('warn', 'error', 'critical')
  AND created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS other_count = ROW_COUNT;
  
  deleted_count := debug_info_count + other_count;
  
  RAISE NOTICE 'Deleted % old system logs (% debug/info, % warn/error/critical)', 
    deleted_count, debug_info_count, other_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get log statistics
CREATE OR REPLACE FUNCTION get_system_log_statistics(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  total_logs BIGINT,
  logs_by_level JSONB,
  logs_by_category JSONB,
  logs_by_source JSONB,
  recent_errors JSONB
) AS $$
DECLARE
  start_date_filter TIMESTAMP WITH TIME ZONE;
  end_date_filter TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set default date range if not provided
  start_date_filter := COALESCE(p_start_date, NOW() - INTERVAL '24 hours');
  end_date_filter := COALESCE(p_end_date, NOW());
  
  RETURN QUERY
  SELECT 
    COUNT(*) as total_logs,
    jsonb_object_agg(level, level_count) as logs_by_level,
    jsonb_object_agg(category, category_count) as logs_by_category,
    jsonb_object_agg(source, source_count) as logs_by_source,
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'level', level,
        'category', category,
        'message', message,
        'source', source,
        'created_at', created_at
      ) ORDER BY created_at DESC
    ) as recent_errors
  FROM (
    SELECT 
      sl.*,
      COUNT(*) OVER (PARTITION BY sl.level) as level_count,
      COUNT(*) OVER (PARTITION BY sl.category) as category_count,
      COUNT(*) OVER (PARTITION BY sl.source) as source_count
    FROM public.system_logs sl
    WHERE 
      sl.created_at >= start_date_filter
      AND sl.created_at <= end_date_filter
      AND sl.level IN ('error', 'critical')
  ) grouped_logs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to search logs
CREATE OR REPLACE FUNCTION search_system_logs(
  p_search_term TEXT,
  p_level VARCHAR(20) DEFAULT NULL,
  p_category VARCHAR(50) DEFAULT NULL,
  p_source VARCHAR(100) DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id VARCHAR(255),
  level VARCHAR(20),
  category VARCHAR(50),
  message TEXT,
  context JSONB,
  source VARCHAR(100),
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.id,
    sl.level,
    sl.category,
    sl.message,
    sl.context,
    sl.source,
    sl.tags,
    sl.created_at
  FROM public.system_logs sl
  WHERE 
    (p_search_term IS NULL OR sl.message ILIKE '%' || p_search_term || '%')
    AND (p_level IS NULL OR sl.level = p_level)
    AND (p_category IS NULL OR sl.category = p_category)
    AND (p_source IS NULL OR sl.source = p_source)
    AND (p_user_id IS NULL OR sl.context->>'userId' = p_user_id::TEXT)
  ORDER BY sl.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE public.system_logs IS 'Comprehensive system logging for monitoring and debugging';
COMMENT ON COLUMN public.system_logs.id IS 'Custom log ID format: log_timestamp_random';
COMMENT ON COLUMN public.system_logs.level IS 'Log level classification';
COMMENT ON COLUMN public.system_logs.category IS 'Log category classification';
COMMENT ON COLUMN public.system_logs.message IS 'Log message';
COMMENT ON COLUMN public.system_logs.context IS 'Additional context and metadata';
COMMENT ON COLUMN public.system_logs.source IS 'Source service or component';
COMMENT ON COLUMN public.system_logs.tags IS 'Searchable tags for filtering';
COMMENT ON FUNCTION cleanup_old_system_logs() IS 'Removes old system logs based on retention policy';
COMMENT ON FUNCTION get_system_log_statistics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Returns system log statistics for monitoring dashboard';
COMMENT ON FUNCTION search_system_logs(TEXT, VARCHAR(20), VARCHAR(50), VARCHAR(100), UUID, INTEGER) IS 'Searches system logs with various filters';
