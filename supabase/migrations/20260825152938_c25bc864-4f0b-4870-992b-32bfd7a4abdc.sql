
-- ============ 1. pricing settings (singleton) ============
CREATE TABLE public.domain_pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  sales_enabled boolean NOT NULL DEFAULT false,
  default_markup_percent numeric(10,2) NOT NULL DEFAULT 20,
  default_markup_fixed numeric(12,2) NOT NULL DEFAULT 0,
  min_profit numeric(12,2) NOT NULL DEFAULT 100,
  renewal_markup_percent numeric(10,2) NOT NULL DEFAULT 20,
  tax_percent numeric(10,2) NOT NULL DEFAULT 18,
  tax_inclusive boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'INR',
  fx_mode text NOT NULL DEFAULT 'live',
  fx_manual_rate numeric(12,4),
  offer_badge_text text NOT NULL DEFAULT 'Daily Deal',
  offer_keywords text[] NOT NULL DEFAULT ARRAY['work','remote','jobs','hire','career'],
  offer_tlds text[] NOT NULL DEFAULT ARRAY['com','in','co','net','org','io','shop','online','site','store'],
  supplier_pricing_mode text NOT NULL DEFAULT 'list_api_price',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_pricing_fx_mode_chk CHECK (fx_mode IN ('live','manual')),
  CONSTRAINT domain_pricing_supplier_mode_chk CHECK (supplier_pricing_mode IN ('list_api_price','reseller'))
);

GRANT SELECT ON public.domain_pricing_settings TO anon, authenticated;
GRANT ALL ON public.domain_pricing_settings TO service_role;
ALTER TABLE public.domain_pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read domain pricing settings"
  ON public.domain_pricing_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage domain pricing settings"
  ON public.domain_pricing_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role));

INSERT INTO public.domain_pricing_settings (singleton) VALUES (true);

-- ============ 2. per-TLD pricing ============
CREATE TABLE public.domain_tld_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tld text NOT NULL UNIQUE,
  markup_percent numeric(10,2),
  markup_fixed numeric(12,2),
  promo_customer_price numeric(12,2),
  promo_first_year_only boolean NOT NULL DEFAULT true,
  renewal_markup_percent numeric(10,2),
  is_popular boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.domain_tld_pricing TO anon, authenticated;
GRANT ALL ON public.domain_tld_pricing TO service_role;
ALTER TABLE public.domain_tld_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tld pricing"
  ON public.domain_tld_pricing FOR SELECT USING (true);
CREATE POLICY "Admins manage tld pricing"
  ON public.domain_tld_pricing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role));

-- ============ 3. daily offers ============
CREATE TABLE public.domain_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  domain text NOT NULL,
  tld text NOT NULL,
  available boolean NOT NULL DEFAULT true,
  supplier_cost_usd numeric(12,4),
  supplier_renewal_usd numeric(12,4),
  supplier_list_usd numeric(12,4),
  is_supplier_promo boolean NOT NULL DEFAULT false,
  customer_price numeric(12,2) NOT NULL,
  customer_renewal_price numeric(12,2),
  customer_reference_price numeric(12,2),
  currency text NOT NULL DEFAULT 'INR',
  exchange_rate numeric(12,4),
  rank_score numeric(12,4) NOT NULL DEFAULT 0,
  source_keyword text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_day, domain)
);

CREATE INDEX domain_offers_day_rank_idx ON public.domain_offers (offer_day DESC, rank_score DESC);

GRANT SELECT ON public.domain_offers TO anon, authenticated;
GRANT ALL ON public.domain_offers TO service_role;
ALTER TABLE public.domain_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read domain offers"
  ON public.domain_offers FOR SELECT USING (true);
CREATE POLICY "Admins manage domain offers"
  ON public.domain_offers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role));

-- ============ 4. orders ============
CREATE TABLE public.domain_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domain text NOT NULL,
  tld text NOT NULL,
  period integer NOT NULL DEFAULT 1,
  privacy boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'godaddy',
  supplier_pricing_mode text NOT NULL DEFAULT 'list_api_price',
  supplier_cost numeric(12,4),
  supplier_currency text NOT NULL DEFAULT 'USD',
  exchange_rate numeric(12,4),
  markup_type text,
  markup_value numeric(12,2),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  customer_price numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  payment_amount numeric(12,2),
  profit numeric(12,2),
  renewal_price numeric(12,2),
  status text NOT NULL DEFAULT 'pending',
  status_reason text,
  quote_token text,
  quote_expires_at timestamptz,
  provider_order_id text,
  provider_operation_id text,
  registration_status text,
  payment_provider text NOT NULL DEFAULT 'razorpay',
  payment_order_id text,
  payment_id text,
  contact jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_orders_status_chk CHECK (status IN ('pending','payment_pending','paid','registration_pending','registered','failed','refunded','cancelled'))
);

CREATE INDEX domain_orders_user_idx ON public.domain_orders (user_id, created_at DESC);
CREATE INDEX domain_orders_status_idx ON public.domain_orders (status, created_at DESC);
CREATE INDEX domain_orders_payment_idx ON public.domain_orders (payment_order_id);

GRANT SELECT ON public.domain_orders TO authenticated;
GRANT ALL ON public.domain_orders TO service_role;
ALTER TABLE public.domain_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all domain orders"
  ON public.domain_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role));
CREATE POLICY "Admins manage domain orders"
  ON public.domain_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role));

-- customer-safe view: no supplier cost, no profit, no quote token
CREATE VIEW public.my_domain_orders
WITH (security_invoker = false) AS
SELECT
  o.id, o.user_id, o.domain, o.tld, o.period, o.privacy, o.provider,
  o.customer_price, o.currency, o.payment_amount, o.renewal_price,
  o.status, o.status_reason, o.registration_status,
  o.payment_provider, o.payment_order_id,
  o.quote_expires_at, o.created_at, o.updated_at
FROM public.domain_orders o
WHERE o.user_id = auth.uid();

GRANT SELECT ON public.my_domain_orders TO authenticated;

-- ============ 5. fx rates ============
CREATE TABLE public.domain_fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_day date NOT NULL UNIQUE,
  base_currency text NOT NULL DEFAULT 'USD',
  quote_currency text NOT NULL DEFAULT 'INR',
  rate numeric(12,4) NOT NULL,
  source text NOT NULL DEFAULT 'live',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.domain_fx_rates TO anon, authenticated;
GRANT ALL ON public.domain_fx_rates TO service_role;
ALTER TABLE public.domain_fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read fx rates"
  ON public.domain_fx_rates FOR SELECT USING (true);
CREATE POLICY "Admins manage fx rates"
  ON public.domain_fx_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role));

-- ============ 6. background job state (single-flight + pause) ============
CREATE TABLE public.domain_job_state (
  job_name text PRIMARY KEY,
  is_paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  lease_until timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.domain_job_state TO service_role;
GRANT SELECT ON public.domain_job_state TO authenticated;
ALTER TABLE public.domain_job_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read domain job state"
  ON public.domain_job_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'owner'::public.app_role));

INSERT INTO public.domain_job_state (job_name) VALUES ('domain_offers_refresh');

-- ============ 7. updated_at triggers ============
CREATE OR REPLACE FUNCTION public.set_updated_at_domains()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_domain_pricing_settings_updated BEFORE UPDATE ON public.domain_pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_domains();
CREATE TRIGGER trg_domain_tld_pricing_updated BEFORE UPDATE ON public.domain_tld_pricing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_domains();
CREATE TRIGGER trg_domain_offers_updated BEFORE UPDATE ON public.domain_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_domains();
CREATE TRIGGER trg_domain_orders_updated BEFORE UPDATE ON public.domain_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_domains();
CREATE TRIGGER trg_domain_job_state_updated BEFORE UPDATE ON public.domain_job_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_domains();
