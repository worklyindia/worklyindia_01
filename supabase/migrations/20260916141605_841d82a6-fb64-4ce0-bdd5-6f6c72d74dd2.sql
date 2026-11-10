CREATE TABLE IF NOT EXISTS public.user_outlook_autoreply_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  tone text NOT NULL DEFAULT 'professional',
  language text NOT NULL DEFAULT 'auto',
  business_info text NOT NULL DEFAULT '',
  custom_instructions text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  max_replies_per_run integer NOT NULL DEFAULT 5,
  only_unread boolean NOT NULL DEFAULT true,
  skip_promotions boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_outlook_autoreply_settings TO authenticated;
GRANT ALL ON public.user_outlook_autoreply_settings TO service_role;
ALTER TABLE public.user_outlook_autoreply_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own outlook settings" ON public.user_outlook_autoreply_settings;
CREATE POLICY "Users manage own outlook settings"
ON public.user_outlook_autoreply_settings FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_outlook_reply_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  conversation_id text,
  from_email text,
  subject text,
  snippet text,
  reply_text text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_outlook_reply_log_user_created_idx
  ON public.user_outlook_reply_log (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS user_outlook_reply_log_user_message_idx
  ON public.user_outlook_reply_log (user_id, message_id);

GRANT SELECT, DELETE ON public.user_outlook_reply_log TO authenticated;
GRANT ALL ON public.user_outlook_reply_log TO service_role;
ALTER TABLE public.user_outlook_reply_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own outlook reply log" ON public.user_outlook_reply_log;
CREATE POLICY "Users view own outlook reply log"
ON public.user_outlook_reply_log FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own outlook reply log" ON public.user_outlook_reply_log;
CREATE POLICY "Users delete own outlook reply log"
ON public.user_outlook_reply_log FOR DELETE TO authenticated
USING (auth.uid() = user_id);