CREATE TABLE public.paypal_wallet_balances (
  currency text PRIMARY KEY,
  balance_cents bigint NOT NULL DEFAULT 0,
  credited_cents bigint NOT NULL DEFAULT 0,
  debited_cents bigint NOT NULL DEFAULT 0,
  last_event_created_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.paypal_wallet_balances TO service_role;

ALTER TABLE public.paypal_wallet_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.paypal_wallet_balances
  FOR ALL TO service_role USING (true) WITH CHECK (true);