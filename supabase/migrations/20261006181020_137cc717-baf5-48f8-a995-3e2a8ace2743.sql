CREATE TABLE public.active_payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id text NOT NULL,
  session_type text NOT NULL,
  provider_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  session_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_type)
);

GRANT SELECT ON public.active_payment_sessions TO authenticated;
GRANT ALL ON public.active_payment_sessions TO service_role;

ALTER TABLE public.active_payment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own active payment sessions"
ON public.active_payment_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages active payment sessions"
ON public.active_payment_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX active_payment_sessions_user_status_idx
ON public.active_payment_sessions (user_id, status, expires_at DESC);

CREATE OR REPLACE FUNCTION public.touch_active_payment_session_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_active_payment_sessions_updated_at
BEFORE UPDATE ON public.active_payment_sessions
FOR EACH ROW
EXECUTE FUNCTION public.touch_active_payment_session_updated_at();