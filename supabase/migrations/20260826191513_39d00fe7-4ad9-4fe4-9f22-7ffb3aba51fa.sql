ALTER TABLE public.ai_pricing_modules
  ADD COLUMN IF NOT EXISTS allow_edit_plans boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_retire_plans boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_plan_edits_per_run integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_plan_retires_per_run integer NOT NULL DEFAULT 1;

ALTER TABLE public.ai_pricing_plan_proposals
  ADD COLUMN IF NOT EXISTS change_type text NOT NULL DEFAULT 'create',
  ADD COLUMN IF NOT EXISTS target_item_id text;