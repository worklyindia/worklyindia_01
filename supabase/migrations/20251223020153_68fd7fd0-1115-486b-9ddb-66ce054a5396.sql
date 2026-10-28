-- ============================================================================
-- IMMEDIATE DATA CLEANUP
-- ============================================================================

-- Step 1: Delete old live_sessions (7 days+)
DELETE FROM live_sessions WHERE created_at < NOW() - INTERVAL '7 days';

-- Step 2: Delete old service_health_checks (3 days+)
DELETE FROM service_health_checks WHERE checked_at < NOW() - INTERVAL '3 days';

-- Step 3: Delete old whatsapp_webhook_logs (7 days+)
DELETE FROM whatsapp_webhook_logs WHERE processed_at < NOW() - INTERVAL '7 days';

-- Step 4: Delete old search_history (14 days+)
DELETE FROM search_history WHERE created_at < NOW() - INTERVAL '14 days';

-- Step 5: Delete old interview_cleanup_logs (7 days+)
DELETE FROM interview_cleanup_logs WHERE created_at < NOW() - INTERVAL '7 days';

-- Step 6: Delete old daily_unique_visitors (30 days+)
DELETE FROM daily_unique_visitors WHERE visit_date < NOW() - INTERVAL '30 days';

-- Step 7: Delete old api_health_checks (3 days+)
DELETE FROM api_health_checks WHERE checked_at < NOW() - INTERVAL '3 days';

-- Step 8: Delete old function_logs (7 days+)
DELETE FROM function_logs WHERE created_at < NOW() - INTERVAL '7 days';

-- Step 9: Delete old api_request_logs (7 days+)
DELETE FROM api_request_logs WHERE created_at < NOW() - INTERVAL '7 days';

-- Step 10: Delete old ai_response_cache (14 days+)
DELETE FROM ai_response_cache WHERE created_at < NOW() - INTERVAL '14 days';

-- Step 11: Delete old cached_audio (14 days+)
DELETE FROM cached_audio WHERE created_at < NOW() - INTERVAL '14 days';

-- Step 12: Schedule daily cleanup at 3:00 AM IST (9:30 PM UTC)
SELECT cron.schedule(
  'daily-auto-cleanup',
  '30 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/auto-cleanup-data',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{"source": "cron", "scheduled": true}'::jsonb
  ) AS request_id;
  $$
);