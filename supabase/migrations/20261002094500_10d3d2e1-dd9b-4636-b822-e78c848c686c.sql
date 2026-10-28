UPDATE public.social_connections SET account_id = '' WHERE account_id IS NULL;
ALTER TABLE public.social_connections ALTER COLUMN account_id SET DEFAULT '', ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.social_connections ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;
ALTER TABLE public.social_connections DROP CONSTRAINT IF EXISTS social_connections_user_id_platform_key;
ALTER TABLE public.social_connections ADD CONSTRAINT social_connections_user_platform_account_key UNIQUE (user_id, platform, account_id);

ALTER TABLE public.social_autoreply_settings ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT '';
ALTER TABLE public.social_autoreply_settings DROP CONSTRAINT IF EXISTS social_autoreply_settings_user_id_platform_key;
ALTER TABLE public.social_autoreply_settings ADD CONSTRAINT social_autoreply_settings_user_platform_account_key UNIQUE (user_id, platform, account_id);

ALTER TABLE public.ai_platform_business_profiles ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT '';
ALTER TABLE public.ai_platform_business_profiles DROP CONSTRAINT IF EXISTS ai_platform_business_profiles_user_platform_key;
ALTER TABLE public.ai_platform_business_profiles ADD CONSTRAINT ai_platform_business_profiles_user_platform_account_key UNIQUE (user_id, platform, account_id);

ALTER TABLE public.social_autoreply_log ADD COLUMN IF NOT EXISTS account_id text NOT NULL DEFAULT '';