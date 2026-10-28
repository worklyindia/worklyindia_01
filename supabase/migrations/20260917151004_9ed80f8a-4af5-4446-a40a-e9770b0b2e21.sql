CREATE TABLE IF NOT EXISTS public.telegram_audience_bots (
  audience text PRIMARY KEY CHECK (audience IN ('job_seeker','employer')),
  bot_token text,
  bot_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_audience_bots TO authenticated;
GRANT ALL ON public.telegram_audience_bots TO service_role;

ALTER TABLE public.telegram_audience_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins manage telegram audience bots"
ON public.telegram_audience_bots
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_telegram_audience_bots_updated_at
BEFORE UPDATE ON public.telegram_audience_bots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();