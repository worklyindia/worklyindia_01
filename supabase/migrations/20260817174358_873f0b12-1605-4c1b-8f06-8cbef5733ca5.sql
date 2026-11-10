ALTER TABLE public.user_gmail_autoreply_settings
  ADD COLUMN IF NOT EXISTS reply_scope text NOT NULL DEFAULT 'all';

ALTER TABLE public.user_custom_email_settings
  ADD COLUMN IF NOT EXISTS skip_promotions boolean NOT NULL DEFAULT true;