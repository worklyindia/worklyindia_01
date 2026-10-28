-- Fix get_audit_logs function to properly retrieve admin_email, admin_name, and target_email
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
  -- Check if user is admin (owner or admin role)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    aal.id,
    aal.admin_user_id,
    COALESCE(au.email, '') as admin_email,
    COALESCE(ap.full_name, au.email, 'Unknown') as admin_name,
    aal.action_type,
    aal.target_user_id,
    COALESCE(tu.email, '') as target_email,
    aal.changes,
    aal.ip_address,
    aal.logged_at
  FROM admin_activity_log aal
  LEFT JOIN auth.users au ON au.id = aal.admin_user_id
  LEFT JOIN profiles ap ON ap.user_id = aal.admin_user_id
  LEFT JOIN auth.users tu ON tu.id = aal.target_user_id
  WHERE p_action_type IS NULL OR aal.action_type = p_action_type
  ORDER BY aal.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Fix get_team_members function to properly retrieve user details
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
  -- Check if user is admin (owner or admin role)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    au.user_id,
    COALESCE(u.email, '') as email,
    COALESCE(p.full_name, u.email, 'Unknown') as full_name,
    au.role,
    COALESCE(ap.permissions, '{}'::jsonb) as permissions,
    u.last_sign_in_at,
    au.created_at,
    COALESCE(p.profile_image_url, '') as avatar_url,
    COALESCE(p.phone, '') as phone,
    COALESCE(p.location, '') as location
  FROM admin_users au
  INNER JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN profiles p ON p.user_id = au.user_id
  LEFT JOIN admin_permissions ap ON ap.user_id = au.user_id
  ORDER BY au.created_at DESC;
END;
$$;