-- Per-user Telegram bots
CREATE TABLE public.user_telegram_bots (
  user_id uuid PRIMARY KEY,
  bot_id bigint,
  bot_username text,
  bot_name text,
  token_ciphertext text NOT NULL,
  webhook_secret text NOT NULL,
  webhook_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_telegram_bots TO service_role;
ALTER TABLE public.user_telegram_bots ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_telegram_bots_bot_id ON public.user_telegram_bots (bot_id);

CREATE TABLE public.user_telegram_ai_settings (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  tone text NOT NULL DEFAULT 'friendly',
  language text NOT NULL DEFAULT 'auto',
  reply_length text NOT NULL DEFAULT 'auto',
  business_info text NOT NULL DEFAULT '',
  custom_instructions text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  skip_abusive boolean NOT NULL DEFAULT true,
  max_replies_per_day integer NOT NULL DEFAULT 0,
  business_hours_only boolean NOT NULL DEFAULT false,
  business_hours_start text NOT NULL DEFAULT '09:00',
  business_hours_end text NOT NULL DEFAULT '21:00',
  last_reply_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_telegram_ai_settings TO service_role;
ALTER TABLE public.user_telegram_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_telegram_ai_reply_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id bigint,
  from_name text,
  user_message text,
  ai_reply text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_telegram_ai_reply_log TO service_role;
ALTER TABLE public.user_telegram_ai_reply_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_tg_reply_log_user ON public.user_telegram_ai_reply_log (user_id, created_at DESC);

-- Per-user connector connections (Gmail etc.)
CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  account_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_gmail_autoreply_settings (
  user_id uuid PRIMARY KEY,
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
GRANT ALL ON public.user_gmail_autoreply_settings TO service_role;
ALTER TABLE public.user_gmail_autoreply_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_gmail_reply_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id text,
  thread_id text,
  from_email text,
  subject text,
  snippet text,
  reply_text text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_gmail_reply_log TO service_role;
ALTER TABLE public.user_gmail_reply_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_gmail_reply_log_user ON public.user_gmail_reply_log (user_id, created_at DESC);
CREATE UNIQUE INDEX idx_user_gmail_reply_log_msg ON public.user_gmail_reply_log (user_id, message_id) WHERE message_id IS NOT NULL;

CREATE TRIGGER update_user_telegram_bots_updated_at BEFORE UPDATE ON public.user_telegram_bots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_telegram_ai_settings_updated_at BEFORE UPDATE ON public.user_telegram_ai_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_app_user_connections_updated_at BEFORE UPDATE ON public.app_user_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_gmail_autoreply_settings_updated_at BEFORE UPDATE ON public.user_gmail_autoreply_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();