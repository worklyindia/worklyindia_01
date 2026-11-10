-- lovable-cron-fallback-reviewed: Gmail/Outlook/IMAP mailboxes connected per user have no shared push channel; 2-minute polling forwards new emails to developer webhooks.
DO $$ BEGIN
  PERFORM cron.unschedule('email-api-webhook-poll') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-api-webhook-poll');
END $$;
SELECT cron.schedule('email-api-webhook-poll', '*/2 * * * *', $$
  select net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/unified-notifications-api/email-api-poll',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{}'::jsonb
  );
$$);