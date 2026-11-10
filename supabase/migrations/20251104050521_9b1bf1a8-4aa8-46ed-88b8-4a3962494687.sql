-- Fix audit logs function - remove non-existent is_archived column reference
-- Drop the specific version with all parameters
DROP FUNCTION IF EXISTS public.get_audit_logs(integer, integer, text, boolean);

-- Recreate without the is_archived parameter and p_action_type filter
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  action text,
  entity_type text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz,
  user_email text,
  user_name text
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
    aal.user_id,
    aal.action,
    aal.entity_type,
    aal.entity_id,
    aal.old_values,
    aal.new_values,
    aal.ip_address,
    aal.user_agent,
    aal.created_at,
    COALESCE(p.email, aal.user_id::text) as user_email,
    COALESCE(p.full_name, 'Unknown User') as user_name
  FROM admin_audit_logs aal
  LEFT JOIN profiles p ON p.user_id = aal.user_id
  ORDER BY aal.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_audit_logs(integer, integer) TO authenticated;

COMMENT ON FUNCTION public.get_audit_logs IS 'Returns audit logs for admin users with pagination';