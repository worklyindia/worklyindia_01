CREATE TABLE IF NOT EXISTS public.linkedin_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  linkedin_sub TEXT,
  linkedin_name TEXT,
  linkedin_email TEXT,
  linkedin_picture TEXT,
  access_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT,
  can_post BOOLEAN NOT NULL DEFAULT false,
  auto_post_jobs BOOLEAN NOT NULL DEFAULT true,
  last_post_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.linkedin_connections TO authenticated;
GRANT ALL ON public.linkedin_connections TO service_role;

ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own linkedin connection"
ON public.linkedin_connections FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own linkedin connection"
ON public.linkedin_connections FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_linkedin_connections_updated_at ON public.linkedin_connections;
CREATE TRIGGER update_linkedin_connections_updated_at
BEFORE UPDATE ON public.linkedin_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();