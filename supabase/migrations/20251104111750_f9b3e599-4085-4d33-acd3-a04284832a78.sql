-- Update get_team_members function to return 'Email not available' instead of UUID when email is missing
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role text,
  permissions jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  profile_image_url text,
  phone text,
  location text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_current_role text;
BEGIN
  -- Get current user
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if current user is admin or owner
  SELECT au.role INTO v_current_role
  FROM admin_users au
  WHERE au.user_id = v_current_user_id;

  IF v_current_role IS NULL OR v_current_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Return team members with proper email handling
  RETURN QUERY
  SELECT 
    au.user_id,
    COALESCE(get_user_email(au.user_id), 'Email not available') as email,
    COALESCE(p.full_name, 'Unknown User') as full_name,
    au.role,
    COALESCE(ap.permissions, '{}'::jsonb) as permissions,
    au.last_sign_in_at,
    au.created_at,
    p.profile_image_url,
    p.phone,
    p.location
  FROM admin_users au
  LEFT JOIN profiles p ON p.user_id = au.user_id
  LEFT JOIN admin_permissions ap ON ap.user_id = au.user_id
  ORDER BY au.created_at DESC;
END;
$$;