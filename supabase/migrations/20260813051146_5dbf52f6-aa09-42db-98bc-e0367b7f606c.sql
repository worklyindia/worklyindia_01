select cron.unschedule('social-autoreply-hourly') where exists (select 1 from cron.job where jobname = 'social-autoreply-hourly');

select cron.schedule(
  'social-autoreply-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-social-api',
    headers:='{"Content-Type": "application/json", "x-cron-key": "9dc843ef14730729169420999e8fa771c6fbc3ce6e283302", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body:='{"action": "social_autoreply_cron"}'::jsonb
  );
  $$
);