ALTER TABLE public.payment_profiles ADD COLUMN IF NOT EXISTS mobile_verified boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS payment_profiles_mobile_unique ON public.payment_profiles (right(regexp_replace(mobile, '\D', '', 'g'), 10)) WHERE mobile IS NOT NULL;

CREATE OR REPLACE FUNCTION public.payment_profiles_sync_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE auth_phone text;
BEGIN
  SELECT u.email, u.phone INTO NEW.email, auth_phone FROM auth.users u WHERE u.id = NEW.user_id;
  NEW.name := NULLIF(btrim(left(coalesce(NEW.name, ''), 80)), '');
  NEW.mobile := NULLIF(regexp_replace(coalesce(NEW.mobile, ''), '[^0-9+]', '', 'g'), '');
  -- Verified only when it matches the OTP-verified login phone.
  NEW.mobile_verified := NEW.mobile IS NOT NULL AND auth_phone IS NOT NULL
    AND right(regexp_replace(NEW.mobile, '\D', '', 'g'), 10) = right(regexp_replace(auth_phone, '\D', '', 'g'), 10);
  IF TG_OP = 'UPDATE' AND NEW.mobile IS DISTINCT FROM OLD.mobile AND NOT NEW.mobile_verified
     AND current_setting('request.jwt.claim.role', true) = 'authenticated' THEN
    RAISE EXCEPTION 'Verify this mobile number with OTP first';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.payment_profiles_sync_email() FROM PUBLIC, anon, authenticated;