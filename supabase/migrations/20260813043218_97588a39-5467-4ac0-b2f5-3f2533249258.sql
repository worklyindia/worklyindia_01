-- Generic social connections (X / LinkedIn), auto-reply settings + logs
CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('x','linkedin','telegram')),
  account_id TEXT,
  account_name TEXT,
  account_handle TEXT,
  account_picture TEXT,
  account_email TEXT,
  followers_count BIGINT DEFAULT 0,
  following_count BIGINT DEFAULT 0,
  posts_count BIGINT DEFAULT 0,
  access_token TEXT,
  refresh_token TEXT,
  token_secret TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT,
  can_post BOOLEAN NOT NULL DEFAULT false,
  profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT ALL ON public.social_connections TO service_role;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own social connections" ON public.social_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.social_autoreply_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('x','linkedin')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  tone TEXT NOT NULL DEFAULT 'friendly',
  language TEXT NOT NULL DEFAULT 'auto',
  reply_scope TEXT NOT NULL DEFAULT 'all',
  reply_length TEXT NOT NULL DEFAULT 'auto',
  max_replies_per_run INTEGER NOT NULL DEFAULT 0,
  custom_instructions TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL DEFAULT '',
  skip_negative BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_autoreply_settings TO authenticated;
GRANT ALL ON public.social_autoreply_settings TO service_role;
ALTER TABLE public.social_autoreply_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own social autoreply settings" ON public.social_autoreply_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.social_autoreply_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  target_id TEXT NOT NULL,
  post_id TEXT,
  post_text TEXT,
  author_name TEXT,
  comment_text TEXT,
  reply_text TEXT,
  status TEXT NOT NULL DEFAULT 'replied',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.social_autoreply_log TO authenticated;
GRANT ALL ON public.social_autoreply_log TO service_role;
ALTER TABLE public.social_autoreply_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own social autoreply log" ON public.social_autoreply_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_social_autoreply_log_user_platform
  ON public.social_autoreply_log (user_id, platform, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_autoreply_log_target
  ON public.social_autoreply_log (user_id, platform, target_id);

CREATE TRIGGER update_social_connections_updated_at BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_social_autoreply_settings_updated_at BEFORE UPDATE ON public.social_autoreply_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();