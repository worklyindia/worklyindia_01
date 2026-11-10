ALTER TABLE public.employer_whatsapp_accounts ADD COLUMN IF NOT EXISTS meta_status text, ADD COLUMN IF NOT EXISTS meta_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.developer_sub_account_numbers ADD COLUMN IF NOT EXISTS meta_status text, ADD COLUMN IF NOT EXISTS meta_blocked boolean NOT NULL DEFAULT false;
DO $$ BEGIN
 PERFORM cron.unschedule('whatsapp-tier-refresh-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-tier-refresh-daily');
END $$;
SELECT cron.schedule('whatsapp-tier-refresh-daily', '20 3 * * *', $$
  select net.http_post(
    url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/whatsapp-api',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4"}'::jsonb,
    body := '{"scope":"tier_refresh"}'::jsonb
  );
$$);