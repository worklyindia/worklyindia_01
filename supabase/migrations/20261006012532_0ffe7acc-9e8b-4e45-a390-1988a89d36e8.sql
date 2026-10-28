CREATE TABLE public.razorpay_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'live',
  customer_id text,
  name text, email text, contact text,
  status text NOT NULL DEFAULT 'creating',
  last_error text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mode),
  UNIQUE (customer_id)
);
GRANT SELECT ON public.razorpay_customers TO authenticated;
GRANT ALL ON public.razorpay_customers TO service_role;
ALTER TABLE public.razorpay_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own razorpay customer" ON public.razorpay_customers FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.razorpay_customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id text,
  order_id text NOT NULL UNIQUE,
  payment_id text UNIQUE,
  purpose text,
  amount bigint,
  currency text NOT NULL DEFAULT 'INR',
  method text,
  status text NOT NULL DEFAULT 'created',
  webhook_verified boolean NOT NULL DEFAULT false,
  error_code text, error_description text,
  last_event text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX razorpay_customer_payments_user_idx ON public.razorpay_customer_payments(user_id);
CREATE INDEX razorpay_customer_payments_customer_idx ON public.razorpay_customer_payments(customer_id);
GRANT SELECT ON public.razorpay_customer_payments TO authenticated;
GRANT ALL ON public.razorpay_customer_payments TO service_role;
ALTER TABLE public.razorpay_customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own razorpay payments" ON public.razorpay_customer_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.rzp_customer_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER razorpay_customers_touch BEFORE UPDATE ON public.razorpay_customers FOR EACH ROW EXECUTE FUNCTION public.rzp_customer_touch();
CREATE TRIGGER razorpay_customer_payments_touch BEFORE UPDATE ON public.razorpay_customer_payments FOR EACH ROW EXECUTE FUNCTION public.rzp_customer_touch();