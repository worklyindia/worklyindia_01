-- Add a specific cron job for Google quota reset at 1:30 PM IST (08:00 UTC)
-- This ensures scheduled items waiting for quota reset get processed immediately

SELECT cron.schedule(
  'scheduled-indexing-quota-reset',
  '0 8 * * *', -- Daily at 08:00 UTC = 1:30 PM IST
  $$
  SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/scheduled-indexing',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body:='{"type": "quota-reset"}'::jsonb
  );
  $$
);

-- Also add a cron at 08:30 UTC (2:00 PM IST) for secondary processing
SELECT cron.schedule(
  'process-indexing-queue-quota-reset',
  '30 8 * * *', -- Daily at 08:30 UTC = 2:00 PM IST  
  $$
  SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/process-indexing-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body:='{"processScheduled": true}'::jsonb
  );
  $$
);