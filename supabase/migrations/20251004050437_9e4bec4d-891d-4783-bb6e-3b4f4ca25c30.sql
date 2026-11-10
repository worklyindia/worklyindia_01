-- Drop the old functions
DROP FUNCTION IF EXISTS public.expire_old_jobs();
DROP FUNCTION IF EXISTS public.delete_expired_jobs();

-- Create new function that immediately deletes expired jobs
CREATE OR REPLACE FUNCTION public.delete_expired_jobs_immediately()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete jobs that have expired (expires_at is in the past)
  WITH deleted AS (
    DELETE FROM public.jobs
    WHERE expires_at < NOW()
      AND status IN ('active', 'expired')
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN COALESCE(deleted_count, 0);
END;
$$;

-- Create trigger function to auto-delete expired jobs
CREATE OR REPLACE FUNCTION public.check_and_delete_expired_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If job is being updated and is now expired, delete it instead
  IF NEW.expires_at < NOW() THEN
    DELETE FROM public.jobs WHERE id = NEW.id;
    RETURN NULL; -- Prevent the update since we deleted it
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger that runs before any update to jobs table
DROP TRIGGER IF EXISTS auto_delete_expired_jobs_trigger ON public.jobs;
CREATE TRIGGER auto_delete_expired_jobs_trigger
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_delete_expired_jobs();

COMMENT ON FUNCTION public.delete_expired_jobs_immediately() IS 'Immediately deletes all expired jobs from the database';
COMMENT ON FUNCTION public.check_and_delete_expired_jobs() IS 'Trigger function that prevents updates to expired jobs by deleting them instead';