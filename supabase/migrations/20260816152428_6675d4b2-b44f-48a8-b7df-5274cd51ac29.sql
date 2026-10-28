CREATE TABLE public.youtube_seo_examples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'gold',
  language TEXT NOT NULL DEFAULT 'hinglish',
  is_short BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  category_id TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.youtube_seo_examples TO authenticated;
GRANT ALL ON public.youtube_seo_examples TO service_role;

ALTER TABLE public.youtube_seo_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and global active SEO examples"
ON public.youtube_seo_examples
FOR SELECT
TO authenticated
USING (is_active AND (user_id IS NULL OR user_id = auth.uid()));

CREATE INDEX idx_youtube_seo_examples_lookup
ON public.youtube_seo_examples (is_active, user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_youtube_seo_examples_updated_at
BEFORE UPDATE ON public.youtube_seo_examples
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();