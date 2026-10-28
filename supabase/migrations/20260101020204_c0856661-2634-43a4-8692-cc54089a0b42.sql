-- Fix search_path for clean_cron_job_history function
CREATE OR REPLACE FUNCTION public.clean_cron_job_history()
RETURNS void AS $$
BEGIN
  -- Keep only last 3 days of cron history
  DELETE FROM cron.job_run_details 
  WHERE start_time < NOW() - INTERVAL '3 days';
  
  -- Also clean old HTTP response cache
  DELETE FROM net._http_response 
  WHERE created < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, cron, net;