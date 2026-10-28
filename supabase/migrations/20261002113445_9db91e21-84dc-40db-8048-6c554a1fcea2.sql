DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_gmail_autoreply_settings','user_outlook_autoreply_settings','user_custom_email_settings','youtube_autoreply_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT ''''', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS account_email text', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false', t);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_pkey');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (user_id, account_id)', t, t || '_pkey');
    EXECUTE format('UPDATE public.%I SET is_default = true WHERE account_id = ''''', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['user_gmail_reply_log','user_outlook_reply_log','user_custom_email_reply_log','youtube_autoreply_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT ''''', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, account_id, created_at DESC)', t || '_acct_idx', t);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.idx_user_gmail_reply_log_msg;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_gmail_reply_log_msg ON public.user_gmail_reply_log (user_id, account_id, message_id) WHERE message_id IS NOT NULL;
DROP INDEX IF EXISTS public.user_outlook_reply_log_user_message_idx;
CREATE UNIQUE INDEX IF NOT EXISTS user_outlook_reply_log_user_message_idx ON public.user_outlook_reply_log (user_id, account_id, message_id);
DROP INDEX IF EXISTS public.user_custom_email_reply_log_user_msg_idx;
CREATE UNIQUE INDEX IF NOT EXISTS user_custom_email_reply_log_user_msg_idx ON public.user_custom_email_reply_log (user_id, account_id, message_id);

ALTER TABLE public.youtube_connections DROP CONSTRAINT IF EXISTS youtube_connections_user_id_key;
ALTER TABLE public.youtube_connections ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
UPDATE public.youtube_connections SET is_default = true;
CREATE UNIQUE INDEX IF NOT EXISTS youtube_connections_user_channel_key ON public.youtube_connections (user_id, channel_id);

ALTER TABLE public.user_telegram_bots ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;