-- Add location columns to jobs table for storing job-specific coordinates
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC,
ADD COLUMN IF NOT EXISTS precise_address TEXT;

-- Migrate existing jobs: Copy company coordinates to job records
UPDATE public.jobs j
SET 
  latitude = c.latitude,
  longitude = c.longitude,
  precise_address = c.precise_address
FROM public.companies c
WHERE j.company_id = c.id
  AND j.latitude IS NULL
  AND c.latitude IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.latitude IS 'Job location latitude for distance calculations';
COMMENT ON COLUMN public.jobs.longitude IS 'Job location longitude for distance calculations';
COMMENT ON COLUMN public.jobs.precise_address IS 'Precise address of job location';