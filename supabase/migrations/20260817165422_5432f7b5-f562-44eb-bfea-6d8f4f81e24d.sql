CREATE TABLE IF NOT EXISTS public.user_custom_email_settings (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  tone text NOT NULL DEFAULT 'professional',
  language text NOT NULL DEFAULT 'auto',
  business_info text NOT NULL DEFAULT '',
  custom_instructions text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  max_replies_per_run integer NOT NULL DEFAULT 5,
  only_unread boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_email_settings TO authenticated;
GRANT ALL ON public.user_custom_email_settings TO service_role;

ALTER TABLE public.user_custom_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own custom email settings"
  ON public.user_custom_email_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_custom_email_reply_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id text NOT NULL,
  from_email text,
  subject text,
  snippet text,
  reply_text text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_custom_email_reply_log_user_msg_idx
  ON public.user_custom_email_reply_log (user_id, message_id);
CREATE INDEX IF NOT EXISTS user_custom_email_reply_log_user_created_idx
  ON public.user_custom_email_reply_log (user_id, created_at DESC);

GRANT SELECT ON public.user_custom_email_reply_log TO authenticated;
GRANT ALL ON public.user_custom_email_reply_log TO service_role;

ALTER TABLE public.user_custom_email_reply_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own custom email reply log"
  ON public.user_custom_email_reply_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_custom_email_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_user_custom_email_settings ON public.user_custom_email_settings;
CREATE TRIGGER trg_touch_user_custom_email_settings
  BEFORE UPDATE ON public.user_custom_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_custom_email_settings();