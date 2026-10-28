CREATE TABLE public.referral_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_profiles TO authenticated;
GRANT ALL ON public.referral_profiles TO service_role;

ALTER TABLE public.referral_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view referral profiles"
ON public.referral_profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own referral profile"
ON public.referral_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral profile"
ON public.referral_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own referral profile"
ON public.referral_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_referral_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_referral_profiles_updated_at
BEFORE UPDATE ON public.referral_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_referral_profiles_updated_at();