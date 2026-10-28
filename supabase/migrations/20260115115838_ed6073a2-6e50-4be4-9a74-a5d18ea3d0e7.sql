-- =============================================
-- GOOGLE INDEXING SYSTEM - CRON JOBS SETUP
-- =============================================

-- 1. Disable old conflicting batch processing cron job (if exists)
SELECT cron.unschedule('batch-indexing-every-2h') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'batch-indexing-every-2h'
);

-- 2. Create cron job to process 1 job every 5 minutes (8 AM - 6 PM UTC = 1:30 PM - 11:30 PM IST)
-- This ensures we stay within the 200/day limit while processing throughout the day
SELECT cron.schedule(
  'process-single-job-every-5min',
  '*/5 8-18 * * *',
  $$SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/process-single-job',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body:='{}'::jsonb
  )$$
);

-- 3. Create cron job to verify indexing status every hour
SELECT cron.schedule(
  'verify-indexing-status-hourly',
  '0 * * * *',
  $$SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/verify-indexing-status',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body:='{"limit": 20}'::jsonb
  )$$
);

-- 4. Create cron job to recalculate queue dates daily at 8 AM UTC
SELECT cron.schedule(
  'recalculate-queue-dates-daily',
  '0 8 * * *',
  $$SELECT recalculate_all_queue_dates()$$
);

-- 5. Reset stuck pending/failed jobs for reprocessing
UPDATE google_indexing_queue
SET 
  status = 'pending',
  scheduled_for = NOW(),
  retry_count = 0,
  error_message = 'Reset for new sequential processing system - ' || NOW()::text
WHERE status IN ('pending', 'failed')
AND retry_count < 5;

-- 6. Recalculate all queue dates now
SELECT recalculate_all_queue_dates();