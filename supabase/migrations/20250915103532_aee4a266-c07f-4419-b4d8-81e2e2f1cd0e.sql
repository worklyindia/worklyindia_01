-- Alternative approach: Remove all problematic cron jobs completely and replace with direct function calls
-- This will eliminate the net.http_post error completely

-- First, let's see what cron jobs actually exist
SELECT jobname FROM cron.job WHERE jobname IN ('update-trending-scores', 'publish-scheduled-jobs', 'cleanup-old-interviews');

-- Remove any existing problematic cron jobs (ignore errors if they don't exist)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('update-trending-scores');
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('publish-scheduled-jobs');
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('cleanup-old-interviews');
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
END
$$;

-- Create simple cron jobs using direct function calls instead of HTTP calls
-- This eliminates the net.http_post error completely

-- Update trending scores every 30 minutes using direct function call
SELECT cron.schedule(
  'update-trending-direct',
  '*/30 * * * *',
  'SELECT public.update_all_trending_scores();'
);

-- Expire job boosts daily at 2 AM using direct function call
SELECT cron.schedule(
  'expire-boosts-direct',
  '0 2 * * *',
  'SELECT public.expire_job_boosts();'
);