select cron.schedule(
  'usage-alerts-daily',
  '10 4 * * *',
  $$
  select net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/usage-alerts',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select token from public.domain_cron_auth limit 1)),
    body:='{}'::jsonb,
    timeout_milliseconds:=120000
  );
  $$
)