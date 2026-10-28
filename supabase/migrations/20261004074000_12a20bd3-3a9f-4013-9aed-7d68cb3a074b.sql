ALTER TABLE public.referral_profiles
  ADD COLUMN IF NOT EXISTS precise_address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text;

UPDATE public.referral_profiles
SET phone = CASE
  WHEN regexp_replace(coalesce(phone, ''), '\D', '', 'g') ~ '^91[0-9]{10}$'
    THEN '+' || regexp_replace(phone, '\D', '', 'g')
  WHEN length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) = 10
    THEN '+91' || regexp_replace(phone, '\D', '', 'g')
  ELSE phone
END
WHERE coalesce(phone, '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS referral_profiles_phone_unique_idx
ON public.referral_profiles ((regexp_replace(phone, '\D', '', 'g')))
WHERE coalesce(phone, '') <> '';

DROP TRIGGER IF EXISTS validate_referral_profile_details ON public.referral_profiles;
CREATE OR REPLACE FUNCTION public.validate_referral_profile_details()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  phone_digits text;
BEGIN
  NEW.display_name := btrim(coalesce(NEW.display_name, ''));
  NEW.phone := btrim(coalesce(NEW.phone, ''));
  NEW.city := btrim(coalesce(NEW.city, ''));
  NEW.state := btrim(coalesce(NEW.state, ''));
  NEW.country := btrim(coalesce(NEW.country, ''));
  NEW.precise_address := btrim(coalesce(NEW.precise_address, ''));
  NEW.postal_code := btrim(coalesce(NEW.postal_code, ''));
  NEW.occupation := btrim(coalesce(NEW.occupation, ''));

  IF NEW.display_name !~ '^[[:alpha:]][[:alpha:] ]{1,21}$' THEN
    RAISE EXCEPTION 'Name must contain only letters and spaces (2-22 characters)';
  END IF;

  phone_digits := regexp_replace(NEW.phone, '\D', '', 'g');
  IF phone_digits ~ '^91[0-9]{10}$' THEN
    NEW.phone := '+' || phone_digits;
  ELSIF length(phone_digits) = 10 THEN
    NEW.phone := '+91' || phone_digits;
  ELSE
    RAISE EXCEPTION 'Please enter a valid 10-digit mobile number';
  END IF;

  IF char_length(NEW.city) < 2 OR char_length(NEW.city) > 80
    OR char_length(NEW.state) < 2 OR char_length(NEW.state) > 80
    OR char_length(NEW.country) < 2 OR char_length(NEW.country) > 80
    OR char_length(NEW.precise_address) < 5 OR char_length(NEW.precise_address) > 300
    OR char_length(NEW.postal_code) < 3 OR char_length(NEW.postal_code) > 12
    OR char_length(NEW.occupation) < 2 OR char_length(NEW.occupation) > 80
    OR char_length(coalesce(NEW.bio, '')) > 300 THEN
    RAISE EXCEPTION 'Referral profile details are missing or exceed the allowed length';
  END IF;

  IF coalesce(NEW.photo_url, '') <> '' AND NEW.photo_url NOT LIKE 'https://%' THEN
    RAISE EXCEPTION 'Profile photo must use a secure URL';
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_referral_profile_details
BEFORE INSERT OR UPDATE ON public.referral_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_referral_profile_details();