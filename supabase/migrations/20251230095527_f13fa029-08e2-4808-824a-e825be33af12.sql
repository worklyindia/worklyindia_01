-- Schedule telegram-scheduled-triggers to run every hour for automated reminders
-- This enables: interview reminders, job expiry alerts, inactive user/employer alerts, 
-- low balance alerts, profile incomplete reminders, subscription expiring alerts, weekly digest

-- First remove any existing job with same name if exists
SELECT cron.unschedule('telegram-scheduled-triggers-hourly') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-scheduled-triggers-hourly');

SELECT cron.unschedule('telegram-scheduled-triggers-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-scheduled-triggers-weekly');

-- Schedule hourly triggers for time-sensitive events
-- Runs every hour at minute 15 (e.g., 00:15, 01:15, 02:15...)
SELECT cron.schedule(
  'telegram-scheduled-triggers-hourly',
  '15 * * * *', -- Every hour at :15
  $$
  SELECT net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/telegram-scheduled-triggers',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{"trigger_type": "all", "source": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule weekly digest - Runs every Sunday at 10:00 AM IST (4:30 AM UTC)
SELECT cron.schedule(
  'telegram-scheduled-triggers-weekly',
  '30 4 * * 0', -- Every Sunday at 4:30 AM UTC (10:00 AM IST)
  $$
  SELECT net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/telegram-scheduled-triggers',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{"trigger_type": "weekly_digest", "source": "cron"}'::jsonb
  ) AS request_id;
  $$
);