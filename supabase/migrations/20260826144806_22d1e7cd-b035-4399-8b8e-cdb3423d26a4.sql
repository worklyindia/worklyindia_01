ALTER TABLE public.domain_pricing_settings
  ADD COLUMN IF NOT EXISTS renewal_markup_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewal_min_profit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewal_fx_buffer_percent numeric NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS payment_fee_percent numeric NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS renewal_fallback_uplift_percent numeric NOT NULL DEFAULT 25;