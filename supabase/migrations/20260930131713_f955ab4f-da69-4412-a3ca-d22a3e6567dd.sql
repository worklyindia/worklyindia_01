CREATE TABLE public.ai_platform_business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  owner_name text,
  owner_role text,
  about_me text,
  business_name text,
  business_type text,
  business_description text,
  products_services text,
  pricing text,
  working_hours text,
  location text,
  contact_info text,
  website text,
  faqs text,
  reply_rules text,
  avoid_topics text,
  tone text NOT NULL DEFAULT 'friendly',
  language text NOT NULL DEFAULT 'auto',
  reply_length text NOT NULL DEFAULT 'medium',
  signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_platform_business_profiles_user_platform_key UNIQUE (user_id, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_platform_business_profiles TO authenticated;
GRANT ALL ON public.ai_platform_business_profiles TO service_role;

ALTER TABLE public.ai_platform_business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own platform AI profiles"
ON public.ai_platform_business_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create own platform AI profiles"
ON public.ai_platform_business_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own platform AI profiles"
ON public.ai_platform_business_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own platform AI profiles"
ON public.ai_platform_business_profiles FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ai_platform_business_profiles_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_platform_business_profiles_touch
BEFORE UPDATE ON public.ai_platform_business_profiles
FOR EACH ROW EXECUTE FUNCTION public.ai_platform_business_profiles_touch();