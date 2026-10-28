-- Fix function overloading conflict for get_audit_logs
-- Drop the old version and ensure only the new enhanced version exists

DROP FUNCTION IF EXISTS public.get_audit_logs(integer, integer, text);
DROP FUNCTION IF EXISTS public.get_audit_logs(integer, integer, text, boolean);

-- Recreate the enhanced version with all parameters
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_action_type text DEFAULT NULL,
  p_include_archived boolean DEFAULT false
)
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
  logged_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view audit logs';
  END IF;

  IF p_include_archived THEN
    -- Query both main and archive tables
    RETURN QUERY
    (
      SELECT 
        al.id,
        al.admin_user_id,
        al.admin_email,
        al.admin_name,
        al.action_type,
        al.target_user_id,
        al.target_email,
        al.changes,
        al.ip_address,
        al.created_at as logged_at
      FROM admin_audit_logs al
      WHERE p_action_type IS NULL OR al.action_type = p_action_type
      
      UNION ALL
      
      SELECT 
        ala.id,
        ala.admin_user_id,
        ala.admin_email,
        ala.admin_name,
        ala.action_type,
        ala.target_user_id,
        ala.target_email,
        ala.changes,
        ala.ip_address,
        ala.created_at as logged_at
      FROM admin_audit_logs_archive ala
      WHERE p_action_type IS NULL OR ala.action_type = p_action_type
    )
    ORDER BY logged_at DESC
    LIMIT p_limit OFFSET p_offset;
  ELSE
    -- Query only main table (default behavior - backward compatible)
    RETURN QUERY
    SELECT 
      al.id,
      al.admin_user_id,
      al.admin_email,
      al.admin_name,
      al.action_type,
      al.target_user_id,
      al.target_email,
      al.changes,
      al.ip_address,
      al.created_at as logged_at
    FROM admin_audit_logs al
    WHERE p_action_type IS NULL OR al.action_type = p_action_type
    ORDER BY al.created_at DESC
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_logs(integer, integer, text, boolean) TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed get_audit_logs function overloading conflict!';
END $$;