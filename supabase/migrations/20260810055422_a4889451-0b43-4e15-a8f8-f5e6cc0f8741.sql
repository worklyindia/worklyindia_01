
CREATE TABLE public.youtube_optimizer_settings (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'review',
  review_after_days integer NOT NULL DEFAULT 7,
  max_jobs_per_day integer NOT NULL DEFAULT 2,
  min_hours_between_jobs integer NOT NULL DEFAULT 12,
  video_cooldown_days integer NOT NULL DEFAULT 14,
  min_confidence text NOT NULL DEFAULT 'high',
  allow_title boolean NOT NULL DEFAULT true,
  allow_thumbnail boolean NOT NULL DEFAULT false,
  allow_tags boolean NOT NULL DEFAULT true,
  allow_description boolean NOT NULL DEFAULT true,
  paused_until timestamptz,
  last_run_at timestamptz,
  last_run_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_optimizer_settings TO authenticated;
GRANT ALL ON public.youtube_optimizer_settings TO service_role;
ALTER TABLE public.youtube_optimizer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own optimizer settings" ON public.youtube_optimizer_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.youtube_optimizer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_id text,
  video_id text NOT NULL,
  video_title text,
  content_type text NOT NULL DEFAULT 'video',
  optimization_cycle integer NOT NULL DEFAULT 1,
  classification text NOT NULL DEFAULT 'INSUFFICIENT_DATA',
  problem text NOT NULL DEFAULT 'INSUFFICIENT_DATA',
  target_element text,
  confidence text NOT NULL DEFAULT 'LOW',
  decision text NOT NULL DEFAULT 'no_change',
  status text NOT NULL DEFAULT 'no_change',
  reason text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  analytics_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  analytics_after jsonb,
  proposal jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_recommendation text,
  cooldown_until timestamptz,
  applied_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX yt_opt_reviews_user_video_idx ON public.youtube_optimizer_reviews (user_id, video_id, created_at DESC);
CREATE INDEX yt_opt_reviews_status_idx ON public.youtube_optimizer_reviews (user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_optimizer_reviews TO authenticated;
GRANT ALL ON public.youtube_optimizer_reviews TO service_role;
ALTER TABLE public.youtube_optimizer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own optimizer reviews" ON public.youtube_optimizer_reviews
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.youtube_optimizer_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  review_id uuid REFERENCES public.youtube_optimizer_reviews(id) ON DELETE SET NULL,
  channel_id text,
  video_id text NOT NULL,
  content_type text NOT NULL DEFAULT 'video',
  optimization_cycle integer NOT NULL DEFAULT 1,
  action_type text NOT NULL,
  previous_title text,
  new_title text,
  previous_thumbnail text,
  new_thumbnail text,
  previous_tags text[],
  new_tags text[],
  previous_description text,
  new_description text,
  reason text,
  analytics_before jsonb,
  analytics_after jsonb,
  ai_confidence text,
  cooldown_until timestamptz,
  status text NOT NULL DEFAULT 'applied',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX yt_opt_log_user_idx ON public.youtube_optimizer_log (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_optimizer_log TO authenticated;
GRANT ALL ON public.youtube_optimizer_log TO service_role;
ALTER TABLE public.youtube_optimizer_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own optimizer log" ON public.youtube_optimizer_log
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER yt_opt_settings_updated_at BEFORE UPDATE ON public.youtube_optimizer_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER yt_opt_reviews_updated_at BEFORE UPDATE ON public.youtube_optimizer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
