CREATE TABLE IF NOT EXISTS public.domain_renewal_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  domain TEXT NOT NULL,
  tld TEXT NOT NULL,
  period INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'INR',
  price_per_year NUMERIC NOT NULL DEFAULT 0,
  customer_price NUMERIC NOT NULL DEFAULT 0,
  supplier_cost NUMERIC,
  exchange_rate NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  status_reason TEXT,
  payment_provider TEXT,
  payment_order_id TEXT,
  payment_id TEXT,
  payment_amount NUMERIC,
  expires_before TIMESTAMPTZ,
  expires_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.domain_renewal_orders TO authenticated;
GRANT ALL ON public.domain_renewal_orders TO service_role;

ALTER TABLE public.domain_renewal_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own renewal orders" ON public.domain_renewal_orders;
CREATE POLICY "Users can view their own renewal orders"
ON public.domain_renewal_orders FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS domain_renewal_orders_user_idx ON public.domain_renewal_orders (user_id, created_at DESC);