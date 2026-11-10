-- Fix: Drop duplicate get_audit_logs functions and create single unified version
-- This resolves the "Could not choose the best candidate function" error

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.get_audit_logs(integer, integer, text);
DROP FUNCTION IF EXISTS public.get_audit_logs(integer, integer, text, boolean);

-- Create single unified function with optional parameters
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_action_type text DEFAULT NULL,
  p_include_archived boolean DEFAULT true
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
    AND admin_users.role IN ('admin', 'owner', 'moderator')
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
  AND (p_include_archived = true OR aal.is_archived = false)
  ORDER BY aal.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_audit_logs TO authenticated;