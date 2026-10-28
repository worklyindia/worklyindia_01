-- ================================================================
-- CRON JOB HISTORY CLEANUP - Recover ~130 MB of database space
-- ================================================================

-- 1. Immediately delete old cron job history (keep last 7 days)
DELETE FROM cron.job_run_details 
WHERE start_time < NOW() - INTERVAL '7 days';

-- 2. Also clean net._http_response (old HTTP request cache)
DELETE FROM net._http_response 
WHERE created < NOW() - INTERVAL '3 days';

-- 3. Create function for ongoing cron history cleanup
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute permission
GRANT EXECUTE ON FUNCTION public.clean_cron_job_history() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clean_cron_job_history() TO service_role;

-- 5. Schedule daily cleanup at 3:00 AM IST (21:30 UTC previous day)
SELECT cron.schedule(
  'clean-cron-history-daily',
  '30 21 * * *',
  'SELECT public.clean_cron_job_history()'
);

-- 6. Delete unused old settings from cleanup_schedule_settings
DELETE FROM cleanup_schedule_settings 
WHERE setting_key IN ('retention_periods', 'auto_cleanup_enabled', 'emergency_cleanup_threshold');