-- Setup cron job to automatically expire jobs daily
SELECT cron.schedule(
  'expire-jobs-daily',
  '0 1 * * *', -- Run at 1:00 AM daily
  $$
  SELECT
    net.http_post(
        url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/expire-jobs',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);