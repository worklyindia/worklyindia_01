-- Fix delete_custom_role function - correct email retrieval from auth.users
DROP FUNCTION IF EXISTS public.delete_custom_role(uuid);

CREATE OR REPLACE FUNCTION public.delete_custom_role(p_role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
  v_member_count integer;
  v_admin_email text;
  v_admin_name text;
  v_client_ip text;
BEGIN
  -- Check if user is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and owners can delete custom roles';
  END IF;

  -- Get role details
  SELECT role_name INTO v_role_name
  FROM team_roles
  WHERE id = p_role_id AND is_custom = true;

  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Custom role not found';
  END IF;

  -- Check if role has any members
  SELECT COUNT(*) INTO v_member_count
  FROM admin_users
  WHERE role = v_role_name;

  IF v_member_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete role: % member(s) currently have this role. Please reassign them first.', v_member_count;
  END IF;

  -- Get admin details for audit log (FIXED: use get_user_email and correct WHERE clause)
  SELECT 
    public.get_user_email(auth.uid()),
    p.full_name, 
    inet_client_addr()::text
  INTO v_admin_email, v_admin_name, v_client_ip
  FROM profiles p
  WHERE p.user_id = auth.uid();

  -- Delete the role
  DELETE FROM team_roles WHERE id = p_role_id;

  -- Log to audit trail
  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address
  ) VALUES (
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'delete_custom_role',
    NULL,
    NULL,
    jsonb_build_object(
      'role_name', v_role_name,
      'role_id', p_role_id
    ),
    v_client_ip
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Custom role deleted successfully',
    'role_name', v_role_name
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_custom_role(uuid) TO authenticated;