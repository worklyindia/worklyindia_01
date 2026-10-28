-- Schedule ping every 5 minutes to keep ai-career-chat warm
-- First unschedule if exists to avoid duplicates
SELECT cron.unschedule('ping-ai-career-chat-every-5-minutes') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ping-ai-career-chat-every-5-minutes'
);

SELECT cron.schedule(
  'ping-ai-career-chat-every-5-minutes',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/ping-ai-career-chat',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
      body := concat('{"timestamp": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);