-- Create table for tracking Supabase usage metrics
CREATE TABLE IF NOT EXISTS public.supabase_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metric_type TEXT NOT NULL, -- 'cached_egress', 'egress', 'database_size', 'edge_invocations', 'realtime_messages', 'realtime_connections', 'storage_size', 'mau', 'mau_third_party', 'mau_sso', 'storage_transformations'
  metric_value BIGINT NOT NULL DEFAULT 0,
  metric_limit BIGINT, -- Free tier limit
  usage_percentage DECIMAL(5,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date, metric_type)
);

-- Create table for egress optimization logs
CREATE TABLE IF NOT EXISTS public.egress_optimization_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  optimization_type TEXT NOT NULL, -- 'cache_cleanup', 'query_optimization', 'realtime_reduction', 'auto_cleanup'
  tables_affected TEXT[],
  rows_deleted BIGINT DEFAULT 0,
  egress_saved_bytes BIGINT DEFAULT 0,
  execution_time_ms INTEGER,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for auto-cleanup settings
CREATE TABLE IF NOT EXISTS public.auto_cleanup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  threshold_percentage INTEGER DEFAULT 70, -- Trigger cleanup when usage > this %
  cleanup_aggressiveness TEXT DEFAULT 'normal', -- 'light', 'normal', 'aggressive'
  retention_days INTEGER DEFAULT 30,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for usage alerts configuration
CREATE TABLE IF NOT EXISTS public.usage_alert_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT UNIQUE NOT NULL,
  warning_threshold INTEGER DEFAULT 70,
  critical_threshold INTEGER DEFAULT 85,
  emergency_threshold INTEGER DEFAULT 95,
  is_enabled BOOLEAN DEFAULT true,
  notify_telegram BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT false,
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.supabase_usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egress_optimization_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_cleanup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_alert_config ENABLE ROW LEVEL SECURITY;

-- Create policies for owner access only
CREATE POLICY "Owners can view usage metrics" ON public.supabase_usage_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can manage usage metrics" ON public.supabase_usage_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can view optimization logs" ON public.egress_optimization_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can manage optimization logs" ON public.egress_optimization_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can view cleanup settings" ON public.auto_cleanup_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can manage cleanup settings" ON public.auto_cleanup_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can view alert config" ON public.usage_alert_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can manage alert config" ON public.usage_alert_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role = 'owner')
  );

-- Insert default cleanup settings
INSERT INTO public.auto_cleanup_settings (setting_key, is_enabled, threshold_percentage, cleanup_aggressiveness, retention_days)
VALUES 
  ('cached_egress', true, 70, 'normal', 7),
  ('database_size', true, 75, 'normal', 30),
  ('notifications', true, 60, 'aggressive', 14),
  ('session_data', true, 50, 'aggressive', 3),
  ('api_logs', true, 70, 'normal', 7),
  ('function_logs', true, 70, 'normal', 7),
  ('ai_cache', true, 80, 'light', 14)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default alert configurations
INSERT INTO public.usage_alert_config (metric_type, warning_threshold, critical_threshold, emergency_threshold, is_enabled)
VALUES 
  ('cached_egress', 70, 85, 95, true),
  ('egress', 70, 85, 95, true),
  ('database_size', 75, 85, 95, true),
  ('edge_invocations', 70, 85, 95, true),
  ('realtime_messages', 70, 85, 95, true),
  ('storage_size', 75, 85, 95, true),
  ('mau', 80, 90, 95, true)
ON CONFLICT (metric_type) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_metrics_date ON public.supabase_usage_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_type ON public.supabase_usage_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_date ON public.egress_optimization_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_type ON public.egress_optimization_logs(optimization_type);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_usage_metrics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
DROP TRIGGER IF EXISTS update_usage_metrics_timestamp ON public.supabase_usage_metrics;
CREATE TRIGGER update_usage_metrics_timestamp
  BEFORE UPDATE ON public.supabase_usage_metrics
  FOR EACH ROW EXECUTE FUNCTION update_usage_metrics_timestamp();

DROP TRIGGER IF EXISTS update_cleanup_settings_timestamp ON public.auto_cleanup_settings;
CREATE TRIGGER update_cleanup_settings_timestamp
  BEFORE UPDATE ON public.auto_cleanup_settings
  FOR EACH ROW EXECUTE FUNCTION update_usage_metrics_timestamp();

DROP TRIGGER IF EXISTS update_alert_config_timestamp ON public.usage_alert_config;
CREATE TRIGGER update_alert_config_timestamp
  BEFORE UPDATE ON public.usage_alert_config
  FOR EACH ROW EXECUTE FUNCTION update_usage_metrics_timestamp();