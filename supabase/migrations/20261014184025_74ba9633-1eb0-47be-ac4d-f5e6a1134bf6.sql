CREATE OR REPLACE FUNCTION public.auth_phone_taken(_digits text, _exclude uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE (_exclude IS NULL OR u.id <> _exclude)
      AND length(_digits) = 10
      AND coalesce(u.email, '') <> ''
      AND (
        right(regexp_replace(coalesce(u.phone,''), '\D', '', 'g'), 10) = _digits
        OR (coalesce(u.raw_user_meta_data->>'phone_verified','false') = 'true'
            AND right(regexp_replace(coalesce(u.raw_user_meta_data->>'mobile_number',''), '\D', '', 'g'), 10) = _digits)
      )
  );
$$;
REVOKE ALL ON FUNCTION public.auth_phone_taken(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_phone_taken(text, uuid) TO service_role;