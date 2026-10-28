ALTER TABLE public.domain_tld_pricing
  ADD COLUMN IF NOT EXISTS multi_year_promo_discount_years integer NOT NULL DEFAULT 1;

ALTER TABLE public.domain_tld_pricing
  DROP CONSTRAINT IF EXISTS domain_tld_pricing_multi_year_promo_discount_years_valid;

ALTER TABLE public.domain_tld_pricing
  ADD CONSTRAINT domain_tld_pricing_multi_year_promo_discount_years_valid
    CHECK (multi_year_promo_discount_years BETWEEN 1 AND 10);