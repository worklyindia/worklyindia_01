ALTER TABLE public.domain_tld_pricing
  ADD COLUMN IF NOT EXISTS multi_year_promo_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS multi_year_promo_min_years integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS multi_year_promo_first_year_price numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS multi_year_promo_ai_managed boolean NOT NULL DEFAULT false;

ALTER TABLE public.domain_tld_pricing
  ADD CONSTRAINT domain_tld_pricing_multi_year_promo_min_years_valid
    CHECK (multi_year_promo_min_years BETWEEN 2 AND 10),
  ADD CONSTRAINT domain_tld_pricing_multi_year_promo_first_year_price_valid
    CHECK (multi_year_promo_first_year_price >= 0 AND multi_year_promo_first_year_price <= 100000);