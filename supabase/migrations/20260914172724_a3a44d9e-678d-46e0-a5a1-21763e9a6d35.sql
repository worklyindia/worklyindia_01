CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_role text NOT NULL DEFAULT 'jobseeker',
  fcm_token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_token_unique UNIQUE (fcm_token)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_enabled_idx ON public.push_subscriptions (enabled);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();