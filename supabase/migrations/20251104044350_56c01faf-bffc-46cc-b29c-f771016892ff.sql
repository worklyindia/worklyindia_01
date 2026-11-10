-- ============================================================================
-- Fix Team Management: Search Users & Audit Log Issues
-- ============================================================================

-- Fix 1: Drop and recreate search_users_by_email with proper JOIN to auth.users
DROP FUNCTION IF EXISTS public.search_users_by_email(text);

CREATE OR REPLACE FUNCTION public.search_users_by_email(p_search text)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can search users';
  END IF;

  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email::text,
    COALESCE(p.full_name, 'Unknown User') as full_name,
    p.profile_image_url as avatar_url,
    EXISTS (
      SELECT 1 FROM admin_users adu 
      WHERE adu.user_id = au.id
    ) as is_admin
  FROM auth.users au
  LEFT JOIN profiles p ON p.user_id = au.id
  WHERE (au.email ILIKE '%' || p_search || '%'
     OR p.full_name ILIKE '%' || p_search || '%')
  AND au.id != auth.uid()  -- Exclude current user
  ORDER BY au.email
  LIMIT 20;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_users_by_email(text) TO authenticated;

-- Fix 2: Ensure audit log permissions are correct
GRANT SELECT ON TABLE public.admin_audit_logs TO authenticated;

-- Fix 3: Ensure get_audit_logs function exists and has proper permissions
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
  logged_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view audit logs';
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
  WHERE (p_action_type IS NULL OR aal.action_type = p_action_type)
  ORDER BY aal.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_logs(integer, integer, text) TO authenticated;