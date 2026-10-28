-- Create function to expire old jobs
CREATE OR REPLACE FUNCTION public.expire_old_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_count INTEGER := 0;
BEGIN
  -- Update expired jobs to 'expired' status
  UPDATE public.jobs
  SET 
    status = 'expired',
    updated_at = now()
  WHERE 
    expires_at <= now() 
    AND status = 'active';
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$;