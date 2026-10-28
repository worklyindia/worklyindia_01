-- Harden get_audit_logs with explicit casts to avoid result type mismatch
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit integer DEFAULT 100, 
  p_offset integer DEFAULT 0, 
  p_action_type text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  admin_user_id uuid,
  admin_email text,
  admin_name text,
  action_type text,
  target_user_id uuid,
  target_email text,
  changes jsonb,
  ip_address text,
  logged_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE public.admin_users.user_id = auth.uid() 
      AND public.admin_users.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    (aal.id)::uuid AS id,
    (aal.admin_user_id)::uuid AS admin_user_id,
    COALESCE((au.email)::text, '') AS admin_email,
    COALESCE((ap.full_name)::text, (au.email)::text, 'Unknown') AS admin_name,
    (aal.action_type)::text AS action_type,
    (aal.target_user_id)::uuid AS target_user_id,
    COALESCE((tu.email)::text, '') AS target_email,
    (aal.changes)::jsonb AS changes,
    COALESCE((aal.ip_address)::text, '') AS ip_address,
    (aal.logged_at)::timestamptz AS logged_at
  FROM public.admin_activity_log aal
  LEFT JOIN auth.users au ON au.id = aal.admin_user_id
  LEFT JOIN public.profiles ap ON ap.user_id = aal.admin_user_id
  LEFT JOIN auth.users tu ON tu.id = aal.target_user_id
  WHERE p_action_type IS NULL OR aal.action_type = p_action_type
  ORDER BY aal.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Harden get_team_members with explicit casts
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  role text,
  permissions jsonb,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone,
  avatar_url text,
  phone text,
  location text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE public.admin_users.user_id = auth.uid() 
      AND public.admin_users.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    (au.user_id)::uuid AS user_id,
    COALESCE((u.email)::text, '') AS email,
    COALESCE((p.full_name)::text, (u.email)::text, 'Unknown') AS full_name,
    (au.role)::text AS role,
    COALESCE((ap.permissions)::jsonb, '{}'::jsonb) AS permissions,
    (u.last_sign_in_at)::timestamptz AS last_sign_in_at,
    (au.created_at)::timestamptz AS created_at,
    COALESCE((p.profile_image_url)::text, '') AS avatar_url,
    COALESCE((p.phone)::text, '') AS phone,
    COALESCE((p.location)::text, '') AS location
  FROM public.admin_users au
  INNER JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN public.profiles p ON p.user_id = au.user_id
  LEFT JOIN public.admin_permissions ap ON ap.user_id = au.user_id
  ORDER BY au.created_at DESC;
END;
$$;