CREATE OR REPLACE FUNCTION public.auth_email_account_info(p_email text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH normalized AS (
    SELECT lower(trim(p_email)) AS email
  ), matched_users AS (
    SELECT DISTINCT u.id
    FROM auth.users u
    CROSS JOIN normalized n
    LEFT JOIN auth.identities i ON i.user_id = u.id
    WHERE u.deleted_at IS NULL
      AND (
        lower(coalesce(u.email, '')) = n.email
        OR lower(coalesce(i.identity_data ->> 'email', '')) = n.email
      )
  ), matched_providers AS (
    SELECT DISTINCT i.provider
    FROM auth.identities i
    JOIN matched_users mu ON mu.id = i.user_id
    CROSS JOIN normalized n
    WHERE lower(coalesce(i.identity_data ->> 'email', '')) = n.email
       OR EXISTS (
         SELECT 1
         FROM auth.users u
         WHERE u.id = mu.id
           AND lower(coalesce(u.email, '')) = n.email
           AND i.provider = 'email'
       )
  )
  SELECT jsonb_build_object(
    'exists', EXISTS (SELECT 1 FROM matched_users),
    'providers', coalesce(
      (SELECT jsonb_agg(provider ORDER BY provider) FROM matched_providers),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_email_account_info(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_email_account_info(text) FROM anon;
REVOKE ALL ON FUNCTION public.auth_email_account_info(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_account_info(text) TO service_role;

CREATE OR REPLACE FUNCTION public.auth_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((public.auth_email_account_info(p_email) ->> 'exists')::boolean, false);
$$;

REVOKE ALL ON FUNCTION public.auth_email_exists(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_email_exists(text) FROM anon;
REVOKE ALL ON FUNCTION public.auth_email_exists(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_exists(text) TO service_role;