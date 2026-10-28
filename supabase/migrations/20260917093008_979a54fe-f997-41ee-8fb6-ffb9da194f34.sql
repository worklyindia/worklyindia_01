CREATE TABLE public.razorpay_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  account_id text,
  entity_type text,
  entity_id text,
  amount_paise bigint,
  currency text,
  status text,
  contact text,
  email text,
  error_code text,
  error_description text,
  notes jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_verified boolean NOT NULL DEFAULT false,
  handled boolean NOT NULL DEFAULT false,
  handler_note text,
  event_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.razorpay_events TO authenticated;
GRANT ALL ON public.razorpay_events TO service_role;

ALTER TABLE public.razorpay_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view razorpay events"
ON public.razorpay_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages razorpay events"
ON public.razorpay_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_razorpay_events_created_at ON public.razorpay_events (created_at DESC);
CREATE INDEX idx_razorpay_events_type ON public.razorpay_events (event_type);
CREATE INDEX idx_razorpay_events_category ON public.razorpay_events (category);
CREATE INDEX idx_razorpay_events_entity_id ON public.razorpay_events (entity_id);

CREATE TRIGGER update_razorpay_events_updated_at
BEFORE UPDATE ON public.razorpay_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();