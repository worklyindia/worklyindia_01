CREATE TABLE public.payment_profiles (
  user_id uuid PRIMARY KEY,
  name text,
  mobile text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payment_profiles TO authenticated;
GRANT ALL ON public.payment_profiles TO service_role;
ALTER TABLE public.payment_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payment profile read" ON public.payment_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own payment profile insert" ON public.payment_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own payment profile update" ON public.payment_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Email always mirrors the sign-in (auth) email; users cannot set it.
CREATE OR REPLACE FUNCTION public.payment_profiles_sync_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT u.email INTO NEW.email FROM auth.users u WHERE u.id = NEW.user_id;
  NEW.name := NULLIF(btrim(left(coalesce(NEW.name, ''), 80)), '');
  NEW.mobile := NULLIF(regexp_replace(coalesce(NEW.mobile, ''), '[^0-9+]', '', 'g'), '');
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER payment_profiles_sync_email BEFORE INSERT OR UPDATE ON public.payment_profiles
FOR EACH ROW EXECUTE FUNCTION public.payment_profiles_sync_email();