ALTER TABLE public.domain_pricing_settings
  ADD COLUMN IF NOT EXISTS ai_pricing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_pricing_auto_apply boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_markup_min_percent numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS ai_markup_max_percent numeric NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS ai_max_over_market_percent numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS ai_audit_last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_audit_last_status text,
  ADD COLUMN IF NOT EXISTS ai_audit_last_health text,
  ADD COLUMN IF NOT EXISTS ai_audit_last_error text;

ALTER TABLE public.domain_tld_pricing
  ADD COLUMN IF NOT EXISTS market_reference_price numeric;

CREATE TABLE IF NOT EXISTS public.domain_price_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  trigger text NOT NULL DEFAULT 'cron',
  ai_enabled boolean NOT NULL DEFAULT false,
  ai_used boolean NOT NULL DEFAULT false,
  ai_status text,
  ai_model text,
  fx_rate numeric,
  fx_source text,
  checked_count integer NOT NULL DEFAULT 0,
  loss_risk_count integer NOT NULL DEFAULT 0,
  overpriced_count integer NOT NULL DEFAULT 0,
  changes_applied integer NOT NULL DEFAULT 0,
  health text NOT NULL DEFAULT 'unknown',
  error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.domain_price_audits TO authenticated;
GRANT ALL ON public.domain_price_audits TO service_role;

ALTER TABLE public.domain_price_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view domain price audits" ON public.domain_price_audits;
CREATE POLICY "Admins can view domain price audits"
  ON public.domain_price_audits FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.role IN ('admin', 'owner')
  ));

CREATE INDEX IF NOT EXISTS domain_price_audits_run_at_idx ON public.domain_price_audits (run_at DESC);

SELECT cron.unschedule('domain-price-ai-audit-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'domain-price-ai-audit-daily');

SELECT cron.schedule(
  'domain-price-ai-audit-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url:='https://jubwzelupbntbetpajqb.supabase.co/functions/v1/check-api-health',
    headers:='{"Content-Type": "application/json", "x-cron-secret": "a4055eb1292869c9d81ba5648fd0fa0063565ca216410c21"}'::jsonb,
    body:='{"action": "cron_price_audit"}'::jsonb
  );
  $$
);