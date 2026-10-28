ALTER TABLE public.youtube_autoreply_settings ALTER COLUMN max_replies_per_run SET DEFAULT 0;
ALTER TABLE public.youtube_autoreply_settings ALTER COLUMN reply_length SET DEFAULT 'auto';
UPDATE public.youtube_autoreply_settings SET max_replies_per_run = 0;

SELECT cron.unschedule('yt-autoreply-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'yt-autoreply-hourly');

SELECT cron.schedule(
  'yt-autoreply-hourly',
  '0 * * * *',
  $$SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-youtube-api',
    headers:='{"Content-Type": "application/json", "x-cron-key": "9dc843ef14730729169420999e8fa771c6fbc3ce6e283302", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body:='{"action": "yt_autoreply_cron"}'::jsonb
  )$$
);