-- Agreement consent capture + renewal reminder preferences on domain orders
ALTER TABLE public.domain_orders
  ADD COLUMN IF NOT EXISTS agreements_accepted jsonb,
  ADD COLUMN IF NOT EXISTS agreements_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_reminders_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.domain_orders.agreements_accepted IS
  'Registry/registrar agreements shown to and accepted by the buyer at checkout (array of {key,title,url}).';
COMMENT ON COLUMN public.domain_orders.agreements_accepted_at IS
  'Timestamp the buyer ticked the agreement consent box at checkout.';
COMMENT ON COLUMN public.domain_orders.expires_at IS
  'Domain expiry date, synced from the registrar; used by the renewal reminder job.';
COMMENT ON COLUMN public.domain_orders.renewal_reminders_enabled IS
  'When false, the renewal reminder job skips this domain.';

-- The reminder job writes with the service role; allow users to see their own log rows only.
-- (SELECT policy "Users read their own domain reminders" already exists.)
CREATE INDEX IF NOT EXISTS idx_domain_orders_reminder_scan
  ON public.domain_orders (expires_at)
  WHERE renewal_reminders_enabled AND status = 'completed';
