-- Update function to delete expired jobs immediately instead of waiting 7 days
CREATE OR REPLACE FUNCTION public.delete_expired_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  -- Delete jobs that are expired (immediately, no grace period)
  DELETE FROM public.jobs
  WHERE status = 'expired' 
    AND expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;