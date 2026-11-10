-- Fix search_users_by_email - profiles doesn't have email column
CREATE OR REPLACE FUNCTION public.search_users_by_email(p_search text)
RETURNS TABLE(user_id uuid, email text, full_name text, avatar_url text, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user is admin (owner or admin role)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Search users by email (exclude existing admins)
  RETURN QUERY
  SELECT 
    p.user_id,
    COALESCE(u.email, '') as email,
    COALESCE(p.full_name, '') as full_name,
    COALESCE(p.profile_image_url, '') as avatar_url,
    EXISTS(SELECT 1 FROM admin_users au WHERE au.user_id = p.user_id) as is_admin
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE 
    u.email ILIKE '%' || p_search || '%'
    OR p.full_name ILIKE '%' || p_search || '%'
  ORDER BY 
    CASE WHEN u.email ILIKE p_search || '%' THEN 1 ELSE 2 END,
    u.email
  LIMIT 10;
END;
$$;

-- Also ensure get_team_members explicitly qualifies the role column
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE(user_id uuid, email text, full_name text, role text, permissions jsonb, last_sign_in_at timestamp with time zone, created_at timestamp with time zone, avatar_url text, phone text, location text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user is admin (owner or admin role)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    au.user_id,
    COALESCE(u.email, '') as email,
    COALESCE(p.full_name, u.email, 'Unknown') as full_name,
    au.role::text,  -- Explicitly use admin_users.role, not auth.users.role
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