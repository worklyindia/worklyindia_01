CREATE TABLE public.ai_pricing_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL UNIQUE,
  label text NOT NULL,
  price_kind text NOT NULL DEFAULT 'inr',
  ai_enabled boolean NOT NULL DEFAULT false,
  auto_apply boolean NOT NULL DEFAULT false,
  unit_cost_inr numeric NOT NULL DEFAULT 0,
  fixed_cost_inr numeric NOT NULL DEFAULT 0,
  points_value_inr numeric NOT NULL DEFAULT 1,
  tax_percent numeric NOT NULL DEFAULT 18,
  payment_fee_percent numeric NOT NULL DEFAULT 2.5,
  min_profit_inr numeric NOT NULL DEFAULT 20,
  min_margin_percent numeric NOT NULL DEFAULT 15,
  max_change_percent numeric NOT NULL DEFAULT 20,
  price_floor_inr numeric NOT NULL DEFAULT 0,
  price_ceiling_inr numeric NOT NULL DEFAULT 0,
  free_tier_enabled boolean NOT NULL DEFAULT false,
  free_tier_units integer NOT NULL DEFAULT 0,
  free_tier_max_cost_inr numeric NOT NULL DEFAULT 0,
  notes text,
  last_run_at timestamptz,
  last_status text,
  last_source text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_pricing_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_pricing_modules TO authenticated;
GRANT ALL ON public.ai_pricing_modules TO service_role;

ALTER TABLE public.ai_pricing_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ai pricing modules"
  ON public.ai_pricing_modules FOR SELECT USING (true);

CREATE POLICY "Admins manage ai pricing modules"
  ON public.ai_pricing_modules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TABLE public.ai_pricing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  item_id text,
  item_name text,
  price_kind text NOT NULL DEFAULT 'inr',
  old_price numeric,
  new_price numeric,
  cost_inr numeric,
  profit_inr numeric,
  margin_percent numeric,
  source text NOT NULL DEFAULT 'rule',
  applied boolean NOT NULL DEFAULT false,
  safe boolean NOT NULL DEFAULT true,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_pricing_audit_log_module_created_idx
  ON public.ai_pricing_audit_log (module, created_at DESC);

GRANT SELECT ON public.ai_pricing_audit_log TO authenticated;
GRANT ALL ON public.ai_pricing_audit_log TO service_role;

ALTER TABLE public.ai_pricing_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ai pricing audit log"
  ON public.ai_pricing_audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_ai_pricing_modules_updated_at
  BEFORE UPDATE ON public.ai_pricing_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_pricing_modules
  (module, label, price_kind, unit_cost_inr, fixed_cost_inr, points_value_inr, min_profit_inr, min_margin_percent, price_floor_inr, price_ceiling_inr, free_tier_enabled, free_tier_units, free_tier_max_cost_inr, notes)
VALUES
  ('wallet_points',      'Wallet Points Packages',  'inr',    0.35, 0,  1, 25, 18, 49,  9999, true,  20, 10, 'Cost per point sold (unit_cost_inr x points_amount).'),
  ('job_boost',          'Job Boost Packages',      'inr',    6,    10, 1, 40, 20, 99,  9999, false, 0,  0,  'Cost per boost day (unit_cost_inr x boost_days).'),
  ('verification_badge', 'Verification Badges',     'inr',    0.8,  25, 1, 60, 22, 199, 19999, false, 0,  0,  'Cost per validity day (unit_cost_inr x validity_days).'),
  ('job_posting',        'Job Posting',             'points', 12,   5,  1, 20, 18, 0,   9999, true,  1,  20, 'Cost per posting month; price charged in wallet points.'),
  ('job_renewal',        'Job Renewal / Extension', 'points', 10,   0,  1, 15, 15, 0,   9999, false, 0,  0,  'Cost per renewal month; price charged in wallet points.'),
  ('interview',          'Interviews',              'points', 1.2,  4,  1, 10, 15, 0,   9999, true,  2,  15, 'unit_cost_inr = infra cost per interview minute; fixed per interview.'),
  ('ai_chat_plan',       'AI Chat Plans',           'inr',    0.06, 8,  1, 30, 20, 0,   9999, true,  25, 12, 'Cost per AI message-equivalent unit across messages, voice and images.');