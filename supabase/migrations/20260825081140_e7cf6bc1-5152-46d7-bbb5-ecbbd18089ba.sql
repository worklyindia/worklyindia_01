CREATE TABLE IF NOT EXISTS public.managed_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domain text NOT NULL,
  provider text NOT NULL DEFAULT 'godaddy',
  status text NOT NULL DEFAULT 'unknown',
  expires_at timestamptz,
  renew_auto boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  nameservers text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, domain)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.managed_domains TO authenticated;
GRANT ALL ON public.managed_domains TO service_role;

ALTER TABLE public.managed_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own domains"
ON public.managed_domains
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all managed domains"
ON public.managed_domains
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX IF NOT EXISTS managed_domains_user_id_idx ON public.managed_domains(user_id);

CREATE TRIGGER update_managed_domains_updated_at
BEFORE UPDATE ON public.managed_domains
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();