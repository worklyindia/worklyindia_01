CREATE TABLE public.api_auto_topup_settings (
  user_id uuid PRIMARY KEY,
  threshold_calls integer NOT NULL DEFAULT 500,
  topup_calls integer NOT NULL DEFAULT 1000,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_auto_topup_settings TO authenticated;
GRANT ALL ON public.api_auto_topup_settings TO service_role;

ALTER TABLE public.api_auto_topup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own auto topup settings"
ON public.api_auto_topup_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);