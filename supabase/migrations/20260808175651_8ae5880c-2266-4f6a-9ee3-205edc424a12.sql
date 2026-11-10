CREATE TABLE IF NOT EXISTS public.youtube_analytics_api (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.youtube_analytics_api TO service_role;
GRANT SELECT ON public.youtube_analytics_api TO authenticated;
ALTER TABLE public.youtube_analytics_api ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage youtube analytics api config"
  ON public.youtube_analytics_api FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE TABLE IF NOT EXISTS public.youtube_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  channel_id text,
  channel_title text,
  channel_thumbnail text,
  subscriber_count bigint DEFAULT 0,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.youtube_connections TO service_role;
GRANT SELECT, DELETE ON public.youtube_connections TO authenticated;
ALTER TABLE public.youtube_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own youtube connection"
  ON public.youtube_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own youtube connection"
  ON public.youtube_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.youtube_analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cache_key text NOT NULL,
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_key)
);
GRANT ALL ON public.youtube_analytics_cache TO service_role;
GRANT SELECT ON public.youtube_analytics_cache TO authenticated;
ALTER TABLE public.youtube_analytics_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own youtube analytics cache"
  ON public.youtube_analytics_cache FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_youtube_connections_updated_at BEFORE UPDATE ON public.youtube_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_youtube_analytics_api_updated_at BEFORE UPDATE ON public.youtube_analytics_api
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();