
DROP VIEW IF EXISTS public.my_domain_orders;

-- customers may read only their own rows...
CREATE POLICY "Users read own domain orders"
  ON public.domain_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ...and only the non-financial columns (column-level grants)
REVOKE SELECT ON public.domain_orders FROM authenticated;
GRANT SELECT (
  id, user_id, domain, tld, period, privacy, provider,
  customer_price, currency, payment_amount, renewal_price,
  status, status_reason, registration_status,
  payment_provider, payment_order_id, quote_expires_at,
  created_at, updated_at
) ON public.domain_orders TO authenticated;

CREATE VIEW public.my_domain_orders
WITH (security_invoker = true) AS
SELECT
  o.id, o.user_id, o.domain, o.tld, o.period, o.privacy, o.provider,
  o.customer_price, o.currency, o.payment_amount, o.renewal_price,
  o.status, o.status_reason, o.registration_status,
  o.payment_provider, o.payment_order_id,
  o.quote_expires_at, o.created_at, o.updated_at
FROM public.domain_orders o
WHERE o.user_id = auth.uid();

GRANT SELECT ON public.my_domain_orders TO authenticated;
