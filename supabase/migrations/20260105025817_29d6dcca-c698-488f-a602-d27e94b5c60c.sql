-- Create sitemap cache table for faster sitemap generation
CREATE TABLE IF NOT EXISTS public.sitemap_cache (
  type TEXT PRIMARY KEY,
  xml_content TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow edge function service role access
ALTER TABLE public.sitemap_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON public.sitemap_cache
  FOR ALL USING (true);

-- Generate public_slug for existing jobs that don't have one
UPDATE public.jobs 
SET public_slug = CONCAT(
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '[^a-zA-Z0-9 ]', '', 'g'), '\s+', '-', 'g')),
  '-',
  SUBSTRING(id::text FROM 1 FOR 8)
)
WHERE public_slug IS NULL AND status = 'active';

-- Create function to auto-generate slug on insert/update
CREATE OR REPLACE FUNCTION public.generate_job_public_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_slug IS NULL OR NEW.public_slug = '' THEN
    NEW.public_slug := CONCAT(
      LOWER(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(NEW.title, 'job'), '[^a-zA-Z0-9 ]', '', 'g'), '\s+', '-', 'g')),
      '-',
      SUBSTRING(NEW.id::text FROM 1 FOR 8)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating slug
DROP TRIGGER IF EXISTS job_slug_trigger ON public.jobs;
CREATE TRIGGER job_slug_trigger
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_job_public_slug();