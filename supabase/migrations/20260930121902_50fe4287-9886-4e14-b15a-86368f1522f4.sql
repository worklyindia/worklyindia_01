CREATE TABLE public.social_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  message_id text NOT NULL,
  channel_id text,
  author text,
  text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, message_id)
);
GRANT ALL ON public.social_inbox TO service_role;
ALTER TABLE public.social_inbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX social_inbox_lookup ON public.social_inbox (user_id, platform, created_at DESC);

ALTER TABLE public.social_autoreply_settings DROP CONSTRAINT IF EXISTS social_autoreply_settings_platform_check;
ALTER TABLE public.social_autoreply_settings ADD CONSTRAINT social_autoreply_settings_platform_check CHECK (platform = ANY (ARRAY['x','linkedin','telegram_bot','gmail','github','gitlab','discord','slack','twitch']));
ALTER TABLE public.social_autoreply_log DROP CONSTRAINT IF EXISTS social_autoreply_log_platform_check;
ALTER TABLE public.social_autoreply_log ADD CONSTRAINT social_autoreply_log_platform_check CHECK (platform = ANY (ARRAY['x','linkedin','telegram_bot','gmail','github','gitlab','discord','slack','twitch']));