CREATE TABLE public.youtube_seo_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id TEXT NOT NULL,
  ai_title TEXT,
  ai_description TEXT,
  ai_hashtags TEXT[] NOT NULL DEFAULT '{}',
  ai_tags TEXT[] NOT NULL DEFAULT '{}',
  final_title TEXT,
  final_description TEXT,
  final_hashtags TEXT[] NOT NULL DEFAULT '{}',
  final_tags TEXT[] NOT NULL DEFAULT '{}',
  category_id TEXT,
  edited_fields TEXT[] NOT NULL DEFAULT '{}',
  removed_tags TEXT[] NOT NULL DEFAULT '{}',
  added_tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_seo_feedback TO authenticated;
GRANT ALL ON public.youtube_seo_feedback TO service_role;

ALTER TABLE public.youtube_seo_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own YouTube SEO feedback"
ON public.youtube_seo_feedback
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_youtube_seo_feedback_user_created
ON public.youtube_seo_feedback (user_id, created_at DESC);

CREATE TRIGGER update_youtube_seo_feedback_updated_at
BEFORE UPDATE ON public.youtube_seo_feedback
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();