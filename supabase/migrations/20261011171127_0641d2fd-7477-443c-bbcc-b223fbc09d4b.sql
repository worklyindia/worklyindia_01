CREATE OR REPLACE FUNCTION public.before_user_created_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  email_domain text;
  blocked_domains text[] := ARRAY[
    'tempmail.com','temp-mail.org','10minutemail.com','10minutemail.net',
    'guerrillamail.com','guerrillamail.net','guerrillamail.org','mailinator.com',
    'maildrop.cc','throwawaymail.com','yopmail.com','fakeinbox.com',
    'trashmail.com','trashmail.net','dispostable.com','getnada.com',
    'tempail.com','mohmal.com','emailondeck.com','sharklasers.com'
  ];
BEGIN
  user_email := lower(coalesce(event->'user'->>'email', ''));
  email_domain := split_part(user_email, '@', 2);

  IF email_domain = ANY(blocked_domains) THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Temporary or disposable email addresses are not allowed. Please use a valid email address.'
      )
    );
  END IF;

  RETURN jsonb_build_object('decision', 'continue');
END;
$$;

REVOKE ALL ON FUNCTION public.before_user_created_hook(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.before_user_created_hook(jsonb) TO supabase_auth_admin;