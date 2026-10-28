CREATE TABLE public.google_user_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product TEXT NOT NULL,
  google_email TEXT,
  google_sub TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  access_token_ciphertext TEXT,
  refresh_token_ciphertext TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'connected',
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, product)
);

GRANT SELECT ON public.google_user_connections TO authenticated;
GRANT ALL ON public.google_user_connections TO service_role;

ALTER TABLE public.google_user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Google connections"
ON public.google_user_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_google_user_connections_user ON public.google_user_connections (user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_google_user_connections_updated_at
BEFORE UPDATE ON public.google_user_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.google_oauth_states (
  state TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL,
  product TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.google_oauth_states TO service_role;

ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;