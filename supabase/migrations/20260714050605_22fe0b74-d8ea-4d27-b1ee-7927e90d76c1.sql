-- 1) Persistent 24-hour cache for Adzuna market-insights aux calls (histogram, top companies, geodata, history, categories)
CREATE TABLE IF NOT EXISTS public.adzuna_insights_cache (
  cache_key text PRIMARY KEY,
  action text NOT NULL,
  keywords text,
  location text,
  category text,
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_adzuna_insights_cache_expires ON public.adzuna_insights_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_adzuna_insights_cache_action ON public.adzuna_insights_cache (action);

GRANT SELECT ON public.adzuna_insights_cache TO anon;
GRANT SELECT ON public.adzuna_insights_cache TO authenticated;
GRANT ALL ON public.adzuna_insights_cache TO service_role;

ALTER TABLE public.adzuna_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read fresh Adzuna cache"
  ON public.adzuna_insights_cache FOR SELECT
  USING (expires_at > now());

CREATE POLICY "Service role manages Adzuna cache"
  ON public.adzuna_insights_cache FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2) Enable AI autonomy flag so the growth planner runs (kill-switch OFF = disabled)
INSERT INTO public.engagement_settings (setting_key, setting_value, description)
VALUES ('ai_autonomy_enabled', 'true'::jsonb, 'Master flag for autonomous AI growth planner + notification scheduling')
ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = 'true'::jsonb, updated_at = now();

-- 3) Explicitly enable each channel (safety — these are read by planners)
INSERT INTO public.engagement_settings (setting_key, setting_value, description) VALUES
  ('platform_push_enabled', 'true'::jsonb, 'Enable OneSignal push notifications'),
  ('platform_email_enabled', 'true'::jsonb, 'Enable Brevo email notifications'),
  ('platform_telegram_bot_enabled', 'true'::jsonb, 'Enable Telegram bot 1:1 messages'),
  ('platform_telegram_channel_enabled', 'true'::jsonb, 'Enable Telegram broadcast channel posts')
ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = 'true'::jsonb, updated_at = now();