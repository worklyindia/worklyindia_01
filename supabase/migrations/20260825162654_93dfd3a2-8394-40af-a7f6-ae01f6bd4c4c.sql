-- 1. Fix domain_orders Data-API grants (remix left them inverted: anon had SELECT, authenticated did not)
GRANT SELECT ON public.domain_orders TO authenticated;
REVOKE SELECT ON public.domain_orders FROM anon;

-- 2. Cron auth token — only service_role can read it; pg_cron runs inside the DB so the value never leaves the server
CREATE TABLE IF NOT EXISTS public.domain_cron_auth (
  id boolean PRIMARY KEY DEFAULT true UNIQUE,
  token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.domain_cron_auth (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
GRANT ALL ON public.domain_cron_auth TO service_role;
ALTER TABLE public.domain_cron_auth ENABLE ROW LEVEL SECURITY;

-- 3. Schedule daily offers refresh + temporary self-test job
DO $$
DECLARE
  t text;
  cmd text;
BEGIN
  SELECT token INTO t FROM public.domain_cron_auth WHERE id = true;
  cmd := format($c$
    SELECT net.http_post(
      url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/check-api-health',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4", "x-cron-secret": "%s"}'::jsonb,
      body:='{"action": "cron_refresh_offers"}'::jsonb
    );$c$, t);
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('domain-offers-daily', 'domain-offers-selftest');
  PERFORM cron.schedule('domain-offers-daily', '30 5 * * *', cmd);
  PERFORM cron.schedule('domain-offers-selftest', '* * * * *', cmd);
END $$;