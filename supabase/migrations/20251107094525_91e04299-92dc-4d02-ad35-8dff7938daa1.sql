-- Schedule health check to run every 5 minutes
SELECT cron.schedule(
  'api-health-check-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/check-api-health',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) AS request_id;
  $$
);
