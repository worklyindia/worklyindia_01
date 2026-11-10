ALTER TABLE public.domain_pricing_settings
  ADD COLUMN IF NOT EXISTS protection_price_per_year numeric NOT NULL DEFAULT 599,
  ADD COLUMN IF NOT EXISTS protection_reference_price numeric NOT NULL DEFAULT 999;