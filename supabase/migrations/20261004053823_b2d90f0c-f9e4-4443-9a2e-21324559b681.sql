ALTER TABLE public.referral_profiles ADD COLUMN IF NOT EXISTS photo_url text, ADD COLUMN IF NOT EXISTS city text, ADD COLUMN IF NOT EXISTS state text, ADD COLUMN IF NOT EXISTS occupation text, ADD COLUMN IF NOT EXISTS bio text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_profiles TO authenticated;
GRANT ALL ON public.referral_profiles TO service_role;
CREATE OR REPLACE FUNCTION public.validate_referral_profile_details() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
IF char_length(coalesce(NEW.display_name,'')) > 22 OR char_length(coalesce(NEW.city,'')) > 80 OR char_length(coalesce(NEW.state,'')) > 80 OR char_length(coalesce(NEW.occupation,'')) > 80 OR char_length(coalesce(NEW.bio,'')) > 300 THEN RAISE EXCEPTION 'Referral profile details exceed the allowed length'; END IF;
IF coalesce(NEW.photo_url,'') <> '' AND NEW.photo_url NOT LIKE 'https://%' THEN RAISE EXCEPTION 'Profile photo must use a secure URL'; END IF;
RETURN NEW; END; $$;
CREATE TRIGGER validate_referral_profile_details BEFORE INSERT OR UPDATE ON public.referral_profiles FOR EACH ROW EXECUTE FUNCTION public.validate_referral_profile_details();