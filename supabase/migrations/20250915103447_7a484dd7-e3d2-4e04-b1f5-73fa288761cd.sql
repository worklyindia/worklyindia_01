-- Fix net.http_post cron jobs by removing the problematic ones and recreating with correct syntax
-- Remove problematic cron jobs that use named parameters
SELECT cron.unschedule('update-trending-scores');
SELECT cron.unschedule('publish-scheduled-jobs');
SELECT cron.unschedule('cleanup-old-interviews');

-- Recreate them with correct positional parameter syntax for net.http_post
-- Update trending scores every 30 minutes
SELECT cron.schedule(
  'update-trending-scores-fixed',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/update-trending-scores',
    '{"timestamp": "' || now() || '"}',
    'application/json',
    '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'
  );
  $$
);

-- Publish scheduled jobs every 5 minutes
SELECT cron.schedule(
  'publish-scheduled-jobs-fixed',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/publish-scheduled-jobs',
    '{"cron_trigger": true}',
    'application/json',
    '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'
  );
  $$
);

-- Cleanup old interviews daily at 2 AM
SELECT cron.schedule(
  'cleanup-old-interviews-fixed',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/cleanup-interviews',
    '{"scheduled": true}',
    'application/json',
    '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNzc2MiwiZXhwIjoyMDcwNDgzNzYyfQ.dFYdmvBaMiKgQHJl0Dpf70DJwkE0ZINxrLWOrSxIQoQ"}'
  );
  $$
);