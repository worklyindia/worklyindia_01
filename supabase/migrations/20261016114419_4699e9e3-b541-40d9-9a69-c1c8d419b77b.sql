CREATE OR REPLACE FUNCTION public.get_login_email_by_phone(p_phone text)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$
DECLARE v_digits text; v_email text;
BEGIN
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  IF length(v_digits) < 8 THEN RETURN NULL; END IF;

  SELECT u.email INTO v_email FROM auth.users u
   WHERE u.email IS NOT NULL AND regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') = v_digits
   ORDER BY u.created_at DESC LIMIT 1;
  IF v_email IS NOT NULL THEN RETURN v_email; END IF;

  SELECT u.email INTO v_email FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
   WHERE u.email IS NOT NULL AND regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = v_digits
   ORDER BY u.created_at DESC LIMIT 1;
  IF v_email IS NOT NULL THEN RETURN v_email; END IF;

  -- Legacy: numbers stored without country code are Indian; only match +91 input.
  IF length(v_digits) = 12 AND left(v_digits, 2) = '91' THEN
    SELECT u.email INTO v_email FROM auth.users u
     WHERE u.email IS NOT NULL AND regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') = right(v_digits, 10)
     ORDER BY u.created_at DESC LIMIT 1;
    IF v_email IS NOT NULL THEN RETURN v_email; END IF;
    SELECT u.email INTO v_email FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
     WHERE u.email IS NOT NULL AND regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = right(v_digits, 10)
     ORDER BY u.created_at DESC LIMIT 1;
  END IF;
  RETURN v_email;
END;
$function$;