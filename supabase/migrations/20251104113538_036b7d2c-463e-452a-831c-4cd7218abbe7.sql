-- Update get_team_members to include profile information
DROP FUNCTION IF EXISTS get_team_members();

CREATE OR REPLACE FUNCTION get_team_members()
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
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    au.user_id,
    COALESCE(
      (SELECT au_inner.email FROM auth.users au_inner WHERE au_inner.id = au.user_id LIMIT 1),
      'Email not available'
    )::text as email,
    COALESCE(
      p.full_name,
      (SELECT COALESCE(
        au_inner.raw_user_meta_data->>'full_name', 
        au_inner.email, 
        'Unknown'
      ) FROM auth.users au_inner WHERE au_inner.id = au.user_id LIMIT 1),
      'Unknown'
    )::text as full_name,
    au.role::text,
    COALESCE(ap.permissions, '{}'::jsonb) as permissions,
    (SELECT au_inner.last_sign_in_at FROM auth.users au_inner WHERE au_inner.id = au.user_id LIMIT 1) as last_sign_in_at,
    au.created_at,
    p.profile_image_url::text,
    p.phone::text,
    p.location::text
  FROM admin_users au
  LEFT JOIN admin_permissions ap ON ap.user_id = au.user_id
  LEFT JOIN profiles p ON p.user_id = au.user_id
  ORDER BY au.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_team_members() TO authenticated;