-- Enable pg_cron extension for scheduled jobs
SELECT cron.schedule(
  'publish-scheduled-jobs',
  '*/5 * * * *', -- Run every 5 minutes
  $$
  select
    net.http_post(
        url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/publish-scheduled-jobs',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
        body:='{"cron_trigger": true}'::jsonb
    ) as request_id;
  $$
);