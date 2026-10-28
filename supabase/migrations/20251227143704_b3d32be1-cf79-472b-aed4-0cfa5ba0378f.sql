-- Create table to store Supabase usage statistics
CREATE TABLE IF NOT EXISTS public.supabase_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  database_size_bytes BIGINT DEFAULT 0,
  storage_size_bytes BIGINT DEFAULT 0,
  edge_function_invocations INTEGER DEFAULT 0,
  realtime_messages INTEGER DEFAULT 0,
  active_sessions INTEGER DEFAULT 0,
  monthly_active_users INTEGER DEFAULT 0,
  egress_bytes BIGINT DEFAULT 0,
  cached_egress_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(date)
);

-- Create table to log cleanup executions
CREATE TABLE IF NOT EXISTS public.cleanup_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  executed_by UUID REFERENCES auth.users(id),
  total_deleted INTEGER DEFAULT 0,
  tables_cleaned JSONB DEFAULT '[]'::jsonb,
  execution_time_ms INTEGER DEFAULT 0,
  triggered_by TEXT DEFAULT 'manual',
  cleanup_type TEXT DEFAULT 'full',
  error_message TEXT
);

-- Create table for cleanup schedule settings
CREATE TABLE IF NOT EXISTS public.cleanup_schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default cleanup settings
INSERT INTO public.cleanup_schedule_settings (setting_key, setting_value, is_enabled)
VALUES 
  ('retention_periods', '{"live_sessions": 7, "service_health_checks": 3, "whatsapp_webhook_logs": 7, "search_history": 14, "interview_cleanup_logs": 7, "api_health_checks": 3, "function_logs": 7, "api_request_logs": 7, "daily_unique_visitors": 30, "ai_response_cache": 30, "cached_audio": 30, "job_interactions": 7, "otp_codes": 1, "webhook_deliveries": 3, "telegram_messages": 7, "push_notification_logs": 5}'::jsonb, true),
  ('auto_cleanup_enabled', '{"enabled": true, "frequency_hours": 6}'::jsonb, true),
  ('emergency_cleanup_threshold', '{"database_percent": 70, "storage_percent": 80}'::jsonb, true)
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.supabase_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanup_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanup_schedule_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access only
CREATE POLICY "Admins can view usage stats" ON public.supabase_usage_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY "Admins can insert usage stats" ON public.supabase_usage_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view cleanup logs" ON public.cleanup_execution_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY "Admins can insert cleanup logs" ON public.cleanup_execution_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view cleanup settings" ON public.cleanup_schedule_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY "Admins can update cleanup settings" ON public.cleanup_schedule_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_supabase_usage_stats_date ON public.supabase_usage_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_cleanup_execution_logs_executed_at ON public.cleanup_execution_logs(executed_at DESC);