-- Real market anchors for domain pricing: separate first-year market price from
-- the (much higher) market RENEWAL price, and allow an admin/AI supplier renewal cost.
ALTER TABLE public.domain_tld_pricing
  ADD COLUMN IF NOT EXISTS market_renewal_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS supplier_renewal_usd numeric(12,4);

COMMENT ON COLUMN public.domain_tld_pricing.market_reference_price IS 'Typical Indian market FIRST-YEAR selling price per year (INR), incl. promos.';
COMMENT ON COLUMN public.domain_tld_pricing.market_renewal_price IS 'Typical Indian market RENEWAL price per year (INR) - the honest regular price.';
COMMENT ON COLUMN public.domain_tld_pricing.supplier_renewal_usd IS 'Our true supplier renewal cost per year in USD, when known.';

ALTER TABLE public.domain_pricing_settings
  ADD COLUMN IF NOT EXISTS reseller_cost_discount_percent numeric(6,2) NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS market_cap_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.domain_pricing_settings.reseller_cost_discount_percent IS 'Assumed discount off the market renewal price that represents our real supplier cost, used when GoDaddy reports no renewal cost.';
COMMENT ON COLUMN public.domain_pricing_settings.market_cap_enabled IS 'When true, selling prices are capped at market price + ai_max_over_market_percent (never below the loss floor).';

