
CREATE TABLE IF NOT EXISTS public.youtube_autoreply_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  tone TEXT NOT NULL DEFAULT 'friendly',
  language TEXT NOT NULL DEFAULT 'auto',
  reply_scope TEXT NOT NULL DEFAULT 'all',
  reply_length TEXT NOT NULL DEFAULT 'short',
  max_replies_per_run INT NOT NULL DEFAULT 10,
  custom_instructions TEXT DEFAULT '',
  signature TEXT DEFAULT '',
  skip_negative BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_autoreply_settings TO authenticated;
GRANT ALL ON public.youtube_autoreply_settings TO service_role;
ALTER TABLE public.youtube_autoreply_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own autoreply settings" ON public.youtube_autoreply_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.youtube_autoreply_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  video_id TEXT,
  video_title TEXT,
  is_short BOOLEAN,
  author_name TEXT,
  comment_text TEXT,
  reply_text TEXT,
  status TEXT NOT NULL DEFAULT 'replied',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, comment_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_autoreply_log TO authenticated;
GRANT ALL ON public.youtube_autoreply_log TO service_role;
ALTER TABLE public.youtube_autoreply_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own autoreply log" ON public.youtube_autoreply_log
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_yt_autoreply_log_user_created
  ON public.youtube_autoreply_log (user_id, created_at DESC);
