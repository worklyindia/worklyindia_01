CREATE TABLE public.user_chat_bots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('discord','slack','twitch')),
  bot_external_id TEXT,
  bot_username TEXT,
  bot_name TEXT,
  token_ciphertext TEXT NOT NULL,
  extra_ciphertext TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_chat_bots TO authenticated;
GRANT ALL ON public.user_chat_bots TO service_role;
ALTER TABLE public.user_chat_bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own chat bots" ON public.user_chat_bots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_chat_bot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('discord','slack','twitch')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  tone TEXT NOT NULL DEFAULT 'friendly',
  language TEXT NOT NULL DEFAULT 'auto',
  reply_length TEXT NOT NULL DEFAULT 'auto',
  business_info TEXT NOT NULL DEFAULT '',
  custom_instructions TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL DEFAULT '',
  skip_abusive BOOLEAN NOT NULL DEFAULT true,
  max_replies_per_day INTEGER NOT NULL DEFAULT 0,
  business_hours_only BOOLEAN NOT NULL DEFAULT false,
  business_hours_start TEXT NOT NULL DEFAULT '09:00',
  business_hours_end TEXT NOT NULL DEFAULT '21:00',
  last_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_chat_bot_settings TO authenticated;
GRANT ALL ON public.user_chat_bot_settings TO service_role;
ALTER TABLE public.user_chat_bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own chat bot settings" ON public.user_chat_bot_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_chat_bot_reply_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  channel_ref TEXT,
  from_name TEXT,
  user_message TEXT,
  ai_reply TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_chat_bot_reply_log TO authenticated;
GRANT ALL ON public.user_chat_bot_reply_log TO service_role;
ALTER TABLE public.user_chat_bot_reply_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own chat bot reply log" ON public.user_chat_bot_reply_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_user_chat_bot_reply_log_user ON public.user_chat_bot_reply_log (user_id, platform, created_at DESC);