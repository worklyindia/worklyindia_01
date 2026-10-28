ALTER TABLE public.social_connections DROP CONSTRAINT IF EXISTS social_connections_platform_check;
ALTER TABLE public.social_connections ADD CONSTRAINT social_connections_platform_check CHECK (platform = ANY (ARRAY[
  'x'::text,'linkedin'::text,'telegram'::text,'telegram_bot'::text,'gmail'::text,
  'github'::text,'gitlab'::text,
  'bitbucket'::text,'discord'::text,'figma'::text,'notion'::text,'twitch'::text,
  'slack'::text,'spotify'::text,'workos'::text,'azure'::text
]));