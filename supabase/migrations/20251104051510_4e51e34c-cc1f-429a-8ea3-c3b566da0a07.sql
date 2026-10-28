-- Drop the existing broken function
DROP FUNCTION IF EXISTS public.get_audit_logs(integer, integer);

-- Create corrected function with proper column mapping
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  admin_user_id uuid,
  admin_email text,
  admin_name text,
  action_type text,
  target_type text,
  target_id uuid,
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
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is admin/owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Return audit logs with proper column names
  RETURN QUERY
  SELECT 
    aal.id,
    aal.admin_user_id,
    COALESCE(p.email, aal.admin_user_id::text) as admin_email,
    COALESCE(p.full_name, 'Unknown User') as admin_name,
    aal.action_type,
    aal.target_type,
    aal.target_id,
    aal.target_user_id,
    aal.target_email,
    aal.changes,
    aal.ip_address,
    aal.logged_at
  FROM admin_audit_logs aal
  LEFT JOIN profiles p ON p.user_id = aal.admin_user_id
  ORDER BY aal.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;