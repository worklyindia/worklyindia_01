ALTER TABLE public.domain_pricing_settings
  ADD COLUMN IF NOT EXISTS promo_allow_below_cost boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_max_loss numeric NOT NULL DEFAULT 0;