CREATE OR REPLACE FUNCTION public.link_signup_verified_phone(_phone_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _caller uuid := auth.uid();
  _me auth.users%ROWTYPE;
  _tmp auth.users%ROWTYPE;
  _want text;
BEGIN
  IF _caller IS NULL OR _phone_user_id IS NULL OR _phone_user_id = _caller THEN
    RETURN false;
  END IF;
  SELECT * INTO _me FROM auth.users WHERE id = _caller;
  IF _me.id IS NULL OR _me.email IS NULL THEN RETURN false; END IF;
  SELECT * INTO _tmp FROM auth.users WHERE id = _phone_user_id;
  IF _tmp.id IS NULL OR _tmp.email IS NOT NULL OR _tmp.phone IS NULL
     OR _tmp.phone_confirmed_at IS NULL
     OR _tmp.phone_confirmed_at < now() - interval '24 hours' THEN
    RETURN false;
  END IF;
  _want := right(regexp_replace(coalesce(_me.raw_user_meta_data->>'mobile_number', ''), '\D', '', 'g'), 10);
  IF length(_want) <> 10 OR right(regexp_replace(_tmp.phone, '\D', '', 'g'), 10) <> _want THEN
    RETURN false;
  END IF;

  DELETE FROM public.profiles WHERE user_id = _tmp.id;
  DELETE FROM auth.users WHERE id = _tmp.id;
  UPDATE auth.users
     SET phone = _tmp.phone,
         phone_confirmed_at = _tmp.phone_confirmed_at,
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('phone_verified', true),
         updated_at = now()
   WHERE id = _caller;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.link_signup_verified_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_signup_verified_phone(uuid) TO authenticated;

-- One-time repair for the current account
DELETE FROM public.profiles WHERE user_id = 'b9413b26-052e-4d5a-af66-d1b2d2b595f1';
DELETE FROM auth.users WHERE id = 'b9413b26-052e-4d5a-af66-d1b2d2b595f1' AND email IS NULL;
UPDATE auth.users
   SET phone = '919904923067',
       phone_confirmed_at = coalesce(phone_confirmed_at, now()),
       raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('phone_verified', true),
       updated_at = now()
 WHERE id = '260f9b5f-cf40-42dc-9921-997a5436eaa8';