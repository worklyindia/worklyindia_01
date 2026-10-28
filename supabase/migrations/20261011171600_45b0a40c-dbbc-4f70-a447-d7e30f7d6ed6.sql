CREATE OR REPLACE FUNCTION public.password_strength_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pwd text := event->>'password';
BEGIN
  IF pwd IS NULL OR length(pwd) < 10
     OR pwd !~ '[A-Z]'
     OR pwd !~ '[0-9]'
     OR pwd !~ '[^A-Za-z0-9]' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 422,
        'message', 'Password must be at least 10 characters and include an uppercase letter, a number, and a special character.'
      )
    );
  END IF;
  RETURN '{}'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.password_strength_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.password_strength_hook(jsonb) FROM authenticated, anon, public;