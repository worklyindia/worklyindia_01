CREATE TABLE public.paypal_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rzp_order_id text NOT NULL,
  paypal_order_id text NOT NULL UNIQUE,
  capture_id text UNIQUE,
  product text,
  label text NOT NULL DEFAULT 'PayPal Payment',
  amount_inr numeric NOT NULL DEFAULT 0,
  amount_usd numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'created',
  refunded_usd numeric NOT NULL DEFAULT 0,
  refunds jsonb NOT NULL DEFAULT '[]'::jsonb,
  payer_email text,
  payer_name text,
  payer_id text,
  webhook_verified boolean NOT NULL DEFAULT false,
  last_event text,
  last_event_id text,
  error_description text,
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX paypal_payments_user_idx ON public.paypal_payments (user_id, created_at DESC);
GRANT SELECT ON public.paypal_payments TO authenticated;
GRANT ALL ON public.paypal_payments TO service_role;
ALTER TABLE public.paypal_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own PayPal payments" ON public.paypal_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.paypal_payments_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER paypal_payments_touch BEFORE UPDATE ON public.paypal_payments FOR EACH ROW EXECUTE FUNCTION public.paypal_payments_touch();