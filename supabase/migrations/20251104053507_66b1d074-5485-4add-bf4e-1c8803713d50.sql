-- Step 1: Migrate existing audit log data from old to new columns
UPDATE admin_audit_logs
SET 
  action_type = COALESCE(action_type, action),
  admin_user_id = COALESCE(admin_user_id, performed_by),
  logged_at = COALESCE(logged_at, performed_at),
  target_user_id = COALESCE(target_user_id, target_id),
  changes = COALESCE(changes, details)
WHERE action_type IS NULL OR admin_user_id IS NULL;

-- Step 2: Populate admin_email and admin_name from auth.users and profiles
UPDATE admin_audit_logs aal
SET 
  admin_email = au.email,
  admin_name = COALESCE(p.full_name, au.email, 'Unknown Admin')
FROM auth.users au
LEFT JOIN profiles p ON p.user_id = au.id
WHERE aal.admin_user_id = au.id
AND (aal.admin_email IS NULL OR aal.admin_name IS NULL);

-- Step 3: Populate target_email from auth.users
UPDATE admin_audit_logs aal
SET target_email = au.email
FROM auth.users au
WHERE aal.target_user_id = au.id
AND aal.target_email IS NULL;

-- Step 4: Update get_audit_logs function to handle both old and new formats
CREATE OR REPLACE FUNCTION get_audit_logs(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
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
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    aal.id,
    COALESCE(aal.admin_user_id, aal.performed_by) as admin_user_id,
    COALESCE(aal.admin_email, au.email::text, 'Unknown') as admin_email,
    COALESCE(aal.admin_name, p.full_name, au.email::text, 'Unknown Admin') as admin_name,
    COALESCE(aal.action_type, aal.action) as action_type,
    COALESCE(aal.target_user_id, aal.target_id) as target_user_id,
    COALESCE(aal.target_email, tu.email::text) as target_email,
    COALESCE(aal.changes, aal.details) as changes,
    aal.ip_address,
    COALESCE(aal.logged_at, aal.performed_at, aal.created_at) as logged_at
  FROM admin_audit_logs aal
  LEFT JOIN auth.users au ON au.id = COALESCE(aal.admin_user_id, aal.performed_by)
  LEFT JOIN profiles p ON p.user_id = au.id
  LEFT JOIN auth.users tu ON tu.id = COALESCE(aal.target_user_id, aal.target_id)
  ORDER BY COALESCE(aal.logged_at, aal.performed_at, aal.created_at) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Step 5: Update search_users_by_email function with better error handling
CREATE OR REPLACE FUNCTION search_users_by_email(p_search text)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  is_admin boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    au.email::text,
    COALESCE(p.full_name, au.email::text, 'Unknown User') as full_name,
    p.profile_image_url as avatar_url,
    EXISTS(
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = p.user_id
    ) as is_admin
  FROM profiles p
  INNER JOIN auth.users au ON au.id = p.user_id
  WHERE 
    (au.email ILIKE '%' || p_search || '%' OR COALESCE(p.full_name, '') ILIKE '%' || p_search || '%')
    AND au.email IS NOT NULL
  ORDER BY 
    CASE WHEN au.email ILIKE p_search || '%' THEN 1 ELSE 2 END,
    p.full_name
  LIMIT 10;
END;
$$;