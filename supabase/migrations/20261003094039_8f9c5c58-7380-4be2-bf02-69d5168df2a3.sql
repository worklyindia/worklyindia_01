ALTER TABLE public.api_auto_topup_settings
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS razorpay_token_id text,
  ADD COLUMN IF NOT EXISTS mandate_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_topup_at timestamptz;

-- Users may edit only their own preference columns; mandate/payment fields are server-only.
REVOKE UPDATE ON public.api_auto_topup_settings FROM authenticated;
GRANT UPDATE (threshold_calls, topup_calls, enabled, updated_at) ON public.api_auto_topup_settings TO authenticated;