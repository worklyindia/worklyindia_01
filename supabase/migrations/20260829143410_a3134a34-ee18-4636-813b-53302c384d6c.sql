ALTER TABLE public.domain_pricing_settings
  ADD COLUMN IF NOT EXISTS offer_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_discount_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS offer_discount_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offer_min_price numeric NOT NULL DEFAULT 99,
  ADD COLUMN IF NOT EXISTS offer_all_tlds boolean NOT NULL DEFAULT true;