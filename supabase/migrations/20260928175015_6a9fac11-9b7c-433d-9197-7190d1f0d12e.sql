DROP TRIGGER IF EXISTS app_secrets_touch ON public.app_secrets;
DROP FUNCTION IF EXISTS public.app_secrets_touch();
DROP POLICY IF EXISTS "Owners manage app secrets" ON public.app_secrets;
REVOKE ALL ON public.app_secrets FROM authenticated;

CREATE TABLE public.owner_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'google_cloud',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_secrets TO authenticated;
GRANT ALL ON public.owner_secrets TO service_role;
ALTER TABLE public.owner_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage owner secrets" ON public.owner_secrets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));
CREATE OR REPLACE FUNCTION public.owner_secrets_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); NEW.updated_by = auth.uid(); RETURN NEW; END; $$;
CREATE TRIGGER owner_secrets_touch BEFORE INSERT OR UPDATE ON public.owner_secrets FOR EACH ROW EXECUTE FUNCTION public.owner_secrets_touch();