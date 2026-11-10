SELECT cron.unschedule('gmail-autoreply-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gmail-autoreply-hourly');
SELECT cron.unschedule('custom-email-autoreply-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'custom-email-autoreply-hourly');

SELECT cron.schedule(
  'gmail-autoreply-hourly',
  '0 * * * *',
  $$SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/email-trigger-handler',
    headers:='{"Content-Type": "application/json", "x-cron-key": "9dc843ef14730729169420999e8fa771c6fbc3ce6e283302", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body:='{"action": "gmail_autoreply_cron"}'::jsonb
  )$$
);

SELECT cron.schedule(
  'custom-email-autoreply-hourly',
  '0 * * * *',
  $$SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/email-trigger-handler',
    headers:='{"Content-Type": "application/json", "x-cron-key": "9dc843ef14730729169420999e8fa771c6fbc3ce6e283302", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body:='{"action": "custom_email_autoreply_cron"}'::jsonb
  )$$
);