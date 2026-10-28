-- Add new columns for job publishing controls
ALTER TABLE public.jobs 
ADD COLUMN visibility text NOT NULL DEFAULT 'public',
ADD COLUMN publish_mode text NOT NULL DEFAULT 'now',
ADD COLUMN scheduled_publish_at timestamptz NULL,
ADD COLUMN published_at timestamptz NULL,
ADD COLUMN is_premiere boolean NOT NULL DEFAULT false,
ADD COLUMN premiere_start_at timestamptz NULL,
ADD COLUMN public_slug text UNIQUE NULL;

-- Add check constraints for valid values
ALTER TABLE public.jobs 
ADD CONSTRAINT jobs_visibility_check CHECK (visibility IN ('public', 'unlisted', 'private')),
ADD CONSTRAINT jobs_publish_mode_check CHECK (publish_mode IN ('now', 'schedule'));

-- Create index for scheduled jobs lookup
CREATE INDEX idx_jobs_scheduled_publish ON public.jobs(scheduled_publish_at) WHERE scheduled_publish_at IS NOT NULL;

-- Create index for public slug lookup
CREATE INDEX idx_jobs_public_slug ON public.jobs(public_slug) WHERE public_slug IS NOT NULL;

-- Backfill existing jobs
UPDATE public.jobs 
SET published_at = created_at 
WHERE published_at IS NULL AND status = 'active';

-- Update RLS policy for jobs visibility
DROP POLICY IF EXISTS "Jobs can be viewed by everyone" ON public.jobs;

CREATE POLICY "Jobs can be viewed by everyone" ON public.jobs
FOR SELECT USING (
  (status = 'active' AND visibility IN ('public', 'unlisted')) 
  OR 
  (EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id = jobs.company_id AND c.user_id = auth.uid()
  ))
);

-- Function to generate unique slug for unlisted jobs
CREATE OR REPLACE FUNCTION generate_job_slug()
RETURNS text AS $$
BEGIN
  RETURN encode(gen_random_bytes(12), 'base64url');
END;
$$ LANGUAGE plpgsql;