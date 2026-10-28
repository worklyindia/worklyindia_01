-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS search_users_by_email(text);
DROP FUNCTION IF EXISTS get_audit_logs(integer, integer);

-- Fix search_users_by_email function to properly join with auth.users
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
    COALESCE(p.full_name, 'Unknown User') as full_name,
    p.profile_image_url as avatar_url,
    EXISTS(
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = p.user_id
    ) as is_admin
  FROM profiles p
  INNER JOIN auth.users au ON au.id = p.user_id
  WHERE 
    au.email ILIKE '%' || p_search || '%'
    OR p.full_name ILIKE '%' || p_search || '%'
  LIMIT 10;
END;
$$;

-- Fix get_audit_logs function to return proper audit log data
CREATE OR REPLACE FUNCTION get_audit_logs(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
RETURNS TABLE (
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
    aal.admin_user_id,
    aal.admin_email,
    aal.admin_name,
    aal.action_type,
    aal.target_user_id,
    aal.target_email,
    aal.changes,
    aal.ip_address,
    aal.logged_at
  FROM admin_audit_logs aal
  ORDER BY aal.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;