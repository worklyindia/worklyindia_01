ALTER TABLE public.ai_pricing_modules
  ADD COLUMN IF NOT EXISTS allow_new_plans boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_new_plans_per_run integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS applied_free_units integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_free_cost_inr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_offer_reason text,
  ADD COLUMN IF NOT EXISTS anomaly_max_factor numeric NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.ai_pricing_plan_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module text NOT NULL,
  name text NOT NULL,
  proposal jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_kind text NOT NULL DEFAULT 'inr',
  price numeric,
  cost_inr numeric,
  floor_inr numeric,
  profit_inr numeric,
  margin_percent numeric,
  tax_percent numeric,
  payment_fee_percent numeric,
  status text NOT NULL DEFAULT 'proposed',
  reason text,
  created_item_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_pricing_plan_proposals TO authenticated;
GRANT ALL ON public.ai_pricing_plan_proposals TO service_role;
ALTER TABLE public.ai_pricing_plan_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read plan proposals" ON public.ai_pricing_plan_proposals;
CREATE POLICY "Admins read plan proposals"
  ON public.ai_pricing_plan_proposals FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX IF NOT EXISTS ai_pricing_plan_proposals_module_idx
  ON public.ai_pricing_plan_proposals (module, created_at DESC);

-- Full automation: every monetized module is now in scope for auto-apply.
UPDATE public.ai_pricing_modules
SET auto_apply = true, review_only = false
WHERE module IN ('ai_chat_plan', 'interview');

-- Modules whose public listing supports AI-created plans/packages.
UPDATE public.ai_pricing_modules
SET allow_new_plans = true
WHERE module IN ('ai_chat_plan', 'wallet_points', 'job_boost');