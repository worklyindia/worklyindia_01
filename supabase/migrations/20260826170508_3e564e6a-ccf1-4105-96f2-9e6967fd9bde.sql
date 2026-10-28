SELECT cron.unschedule('ai-auto-pricing-daily');

SELECT cron.schedule(
  'ai-auto-pricing-daily',
  '45 22 * * *',
  $$
  SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-wallet-api',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
      'x-cron-key', (SELECT token FROM public.domain_cron_auth LIMIT 1)
    ),
    body:='{"action":"ai-price-manager","source":"cron"}'::jsonb
  );
  $$
);