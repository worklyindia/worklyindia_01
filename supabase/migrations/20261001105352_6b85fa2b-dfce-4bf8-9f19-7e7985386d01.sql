ALTER TABLE public.api_subscriptions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'autopay';
UPDATE public.api_subscriptions SET expires_at = coalesce(activated_at, created_at) + interval '31 days'
  WHERE status = 'active' AND expires_at IS NULL;