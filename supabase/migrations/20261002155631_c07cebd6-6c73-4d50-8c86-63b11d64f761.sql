CREATE TABLE IF NOT EXISTS public.developer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  organization text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  use_case text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_profile_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_profiles TO authenticated;
GRANT ALL ON public.developer_profiles TO service_role;
ALTER TABLE public.developer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developers manage own profile" ON public.developer_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);