-- Set up cron job to run interview cleanup daily at 2 AM
SELECT cron.schedule(
  'cleanup-old-interviews',
  '0 2 * * *', -- Daily at 2:00 AM
  $$
  SELECT net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/cleanup-interviews',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNzc2MiwiZXhwIjoyMDcwNDgzNzYyfQ.dFYdmvBaMiKgQHJl0Dpf70DJwkE0ZINxrLWOrSxIQoQ"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  );
  $$
);