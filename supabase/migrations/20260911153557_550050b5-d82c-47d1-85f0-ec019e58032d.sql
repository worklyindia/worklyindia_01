CREATE OR REPLACE FUNCTION public.get_login_email_by_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_digits text;
  v_last10 text;
  v_email text;
BEGIN
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  IF length(v_digits) < 10 THEN
    RETURN NULL;
  END IF;
  v_last10 := right(v_digits, 10);

  SELECT u.email INTO v_email
  FROM auth.users u
  WHERE u.email IS NOT NULL
    AND right(regexp_replace(coalesce(u.phone, ''), '\D', '', 'g'), 10) = v_last10
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  SELECT u.email INTO v_email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email IS NOT NULL
    AND right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = v_last10
  ORDER BY u.created_at DESC
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_login_email_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_email_by_phone(text) TO service_role;