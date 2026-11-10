CREATE TABLE public.razorpay_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payment_id text NOT NULL UNIQUE,
  order_id text,
  invoice_id text UNIQUE,
  invoice_number text,
  short_url text,
  status text NOT NULL DEFAULT 'creating',
  payment_status text,
  refund_status text,
  customer_name text,
  customer_email text,
  amount bigint,
  tax_amount bigint,
  currency text DEFAULT 'INR',
  invoice_date timestamptz,
  mode text NOT NULL DEFAULT 'live',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.razorpay_invoices TO authenticated;
GRANT ALL ON public.razorpay_invoices TO service_role;
ALTER TABLE public.razorpay_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own invoices" ON public.razorpay_invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX razorpay_invoices_user_idx ON public.razorpay_invoices(user_id);
CREATE OR REPLACE FUNCTION public.razorpay_invoices_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER razorpay_invoices_touch BEFORE UPDATE ON public.razorpay_invoices FOR EACH ROW EXECUTE FUNCTION public.razorpay_invoices_touch();