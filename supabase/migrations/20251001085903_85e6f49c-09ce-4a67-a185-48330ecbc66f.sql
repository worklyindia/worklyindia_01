-- Sync job_posting_visibility from companies to employer_settings
-- This ensures both tables have consistent data

-- First, create employer_settings records for any users that don't have them
INSERT INTO public.employer_settings (user_id, job_posting_visibility, created_at, updated_at)
SELECT 
  c.user_id,
  COALESCE(c.job_posting_visibility, true) as job_posting_visibility,
  now() as created_at,
  now() as updated_at
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.employer_settings es 
  WHERE es.user_id = c.user_id
)
ON CONFLICT (user_id) DO NOTHING;

-- Then, update existing employer_settings to match companies table
UPDATE public.employer_settings es
SET 
  job_posting_visibility = COALESCE(c.job_posting_visibility, true),
  updated_at = now()
FROM public.companies c
WHERE es.user_id = c.user_id
  AND (es.job_posting_visibility IS DISTINCT FROM COALESCE(c.job_posting_visibility, true));

-- Create a trigger to keep both tables in sync when companies.job_posting_visibility changes
CREATE OR REPLACE FUNCTION public.sync_job_posting_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When job_posting_visibility changes in companies table, update employer_settings
  IF (TG_OP = 'UPDATE' AND OLD.job_posting_visibility IS DISTINCT FROM NEW.job_posting_visibility) THEN
    INSERT INTO public.employer_settings (user_id, job_posting_visibility, updated_at)
    VALUES (NEW.user_id, NEW.job_posting_visibility, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      job_posting_visibility = EXCLUDED.job_posting_visibility,
      updated_at = EXCLUDED.updated_at;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it already exists
DROP TRIGGER IF EXISTS trigger_sync_job_posting_visibility ON public.companies;

-- Create trigger on companies table
CREATE TRIGGER trigger_sync_job_posting_visibility
  AFTER UPDATE ON public.companies
  FOR EACH ROW
  WHEN (OLD.job_posting_visibility IS DISTINCT FROM NEW.job_posting_visibility)
  EXECUTE FUNCTION public.sync_job_posting_visibility();