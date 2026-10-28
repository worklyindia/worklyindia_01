CREATE TABLE public.whatsapp_audience_accounts (
  audience text PRIMARY KEY CHECK (audience IN ('job_seeker','employer')),
  waba_id text,
  phone_number_id text,
  display_phone text,
  business_name text,
  verified_name text,
  quality_rating text,
  status text NOT NULL DEFAULT 'disconnected',
  connected_via text,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_audience_accounts TO authenticated;
GRANT ALL ON public.whatsapp_audience_accounts TO service_role;
ALTER TABLE public.whatsapp_audience_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and admins view whatsapp audience accounts" ON public.whatsapp_audience_accounts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

CREATE TABLE public.whatsapp_audience_tokens (
  audience text PRIMARY KEY REFERENCES public.whatsapp_audience_accounts(audience) ON DELETE CASCADE,
  access_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_audience_tokens TO service_role;
ALTER TABLE public.whatsapp_audience_tokens ENABLE ROW LEVEL SECURITY;

INSERT INTO public.whatsapp_audience_accounts(audience) VALUES ('job_seeker'),('employer') ON CONFLICT DO NOTHING;