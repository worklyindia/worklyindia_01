-- Create hero_banners table
CREATE TABLE IF NOT EXISTS public.hero_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  gradient TEXT NOT NULL DEFAULT 'from-primary/20 via-primary/10 to-background',
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_hero_banners_active_sort ON public.hero_banners(is_active, sort_order);

-- Enable RLS
ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;

-- Public can read active banners
CREATE POLICY "Anyone can view active hero banners"
  ON public.hero_banners
  FOR SELECT
  USING (is_active = true);

-- Admin users can manage all banners
CREATE POLICY "Admin users can manage hero banners"
  ON public.hero_banners
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create function to get active banners
CREATE OR REPLACE FUNCTION public.get_active_hero_banners()
RETURNS SETOF public.hero_banners
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT *
  FROM public.hero_banners
  WHERE is_active = true
  ORDER BY sort_order ASC, created_at DESC;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_hero_banners_updated_at
  BEFORE UPDATE ON public.hero_banners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing hardcoded banners
INSERT INTO public.hero_banners (title, subtitle, gradient, sort_order, is_active) VALUES
  ('Find Your Dream Workly India Job', 'Connect with top employers hiring remotely', 'from-primary/20 via-primary/10 to-background', 1, true),
  ('15,000+ Remote Opportunities', 'Explore jobs across all industries', 'from-blue-500/20 via-blue-500/10 to-background', 2, true),
  ('100% Free for Job Seekers', 'No hidden charges, unlimited applications', 'from-green-500/20 via-green-500/10 to-background', 3, true),
  ('Top Companies Hiring', 'Join verified employers nationwide', 'from-purple-500/20 via-purple-500/10 to-background', 4, true),
  ('Start Your Remote Career Today', 'Apply in seconds, get hired faster', 'from-orange-500/20 via-orange-500/10 to-background', 5, true);