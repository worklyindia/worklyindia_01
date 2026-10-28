CREATE TABLE public.developer_partner_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  brand_name TEXT NOT NULL,
  tagline TEXT,
  logo_url TEXT,
  website TEXT,
  support_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_partner_profiles TO authenticated;
GRANT ALL ON public.developer_partner_profiles TO service_role;
ALTER TABLE public.developer_partner_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developers manage own partner profile" ON public.developer_partner_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_developer_partner_profiles_updated_at BEFORE UPDATE ON public.developer_partner_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.get_partner_branding(_developer_id uuid)
RETURNS TABLE(brand_name text, tagline text, logo_url text, website text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT brand_name, tagline, logo_url, website
  FROM public.developer_partner_profiles
  WHERE user_id = _developer_id AND status = 'active'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_partner_branding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_branding(uuid) TO authenticated;