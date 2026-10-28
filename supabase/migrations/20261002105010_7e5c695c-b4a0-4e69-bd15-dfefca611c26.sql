-- Facebook / Instagram: allow several Pages / IG accounts per user
ALTER TABLE public.social_meta_accounts DROP CONSTRAINT IF EXISTS social_meta_accounts_user_id_platform_key;
ALTER TABLE public.social_meta_accounts ADD CONSTRAINT social_meta_accounts_user_platform_page_key UNIQUE (user_id, platform, page_id);
ALTER TABLE public.social_meta_accounts ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
UPDATE public.social_meta_accounts m SET is_default = true
WHERE m.id = (SELECT id FROM public.social_meta_accounts x WHERE x.user_id = m.user_id AND x.platform = m.platform ORDER BY created_at LIMIT 1);

-- Telegram: allow several bots per user, each with its own AI settings
ALTER TABLE public.user_telegram_bots DROP CONSTRAINT IF EXISTS user_telegram_bots_pkey;
ALTER TABLE public.user_telegram_bots ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.user_telegram_bots ADD PRIMARY KEY (id);
UPDATE public.user_telegram_bots SET bot_id = 0 WHERE bot_id IS NULL;
ALTER TABLE public.user_telegram_bots ALTER COLUMN bot_id SET DEFAULT 0;
ALTER TABLE public.user_telegram_bots ALTER COLUMN bot_id SET NOT NULL;
ALTER TABLE public.user_telegram_bots ADD CONSTRAINT user_telegram_bots_user_bot_key UNIQUE (user_id, bot_id);
ALTER TABLE public.user_telegram_bots ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
UPDATE public.user_telegram_bots SET is_default = true;
CREATE INDEX IF NOT EXISTS idx_user_telegram_bots_user ON public.user_telegram_bots (user_id);

ALTER TABLE public.user_telegram_ai_settings DROP CONSTRAINT IF EXISTS user_telegram_ai_settings_pkey;
ALTER TABLE public.user_telegram_ai_settings ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.user_telegram_ai_settings ADD PRIMARY KEY (id);
ALTER TABLE public.user_telegram_ai_settings ADD COLUMN IF NOT EXISTS bot_id bigint NOT NULL DEFAULT 0;
UPDATE public.user_telegram_ai_settings s SET bot_id = b.bot_id
FROM public.user_telegram_bots b WHERE b.user_id = s.user_id AND s.bot_id = 0;
ALTER TABLE public.user_telegram_ai_settings ADD CONSTRAINT user_telegram_ai_settings_user_bot_key UNIQUE (user_id, bot_id);

ALTER TABLE public.user_telegram_ai_reply_log ADD COLUMN IF NOT EXISTS bot_id bigint;
CREATE INDEX IF NOT EXISTS idx_user_telegram_reply_log_bot ON public.user_telegram_ai_reply_log (user_id, bot_id, created_at DESC);