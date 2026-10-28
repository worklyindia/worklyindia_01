DROP FUNCTION IF EXISTS public.trigger_update_wallet_balance() CASCADE;
DROP FUNCTION IF EXISTS public.update_points_balance() CASCADE;
DROP FUNCTION IF EXISTS public.send_job_posting_wallet_notification() CASCADE;
DROP FUNCTION IF EXISTS public.send_wallet_transaction_notification() CASCADE;
DROP FUNCTION IF EXISTS public.send_comprehensive_wallet_notification() CASCADE;
DROP FUNCTION IF EXISTS public.notify_points_transaction() CASCADE;

CREATE TABLE public.pending_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purpose text NOT NULL,
  amount_inr integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  razorpay_order_id text UNIQUE,
  razorpay_payment_id text,
  status text NOT NULL DEFAULT 'created',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pending_payments TO authenticated;
GRANT ALL ON public.pending_payments TO service_role;
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pending payments" ON public.pending_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_pending_payments_user ON public.pending_payments(user_id);