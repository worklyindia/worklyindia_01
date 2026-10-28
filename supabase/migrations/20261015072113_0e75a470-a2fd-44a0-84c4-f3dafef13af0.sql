GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can read PayPal payment events" ON public.payment_events FOR SELECT TO authenticated USING (provider = 'paypal' AND public.has_role(auth.uid(), 'owner'::text));
CREATE INDEX IF NOT EXISTS payment_events_provider_created_id_idx ON public.payment_events (provider, created_at DESC, id DESC);