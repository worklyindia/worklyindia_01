-- Fix delete_custom_role function to use correct table names
-- Replaces team_members -> admin_users, team_role_definitions -> custom_roles, audit_logs -> admin_audit_logs

DROP FUNCTION IF EXISTS public.delete_custom_role(uuid);

CREATE OR REPLACE FUNCTION public.delete_custom_role(p_role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
  v_member_count integer;
  v_user_role text;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user has permission (must be owner or admin)
  SELECT role INTO v_user_role
  FROM admin_users
  WHERE user_id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only owners and admins can delete custom roles';
  END IF;

  -- Get role details from custom_roles table
  SELECT role_name
  INTO v_role_name
  FROM custom_roles
  WHERE id = p_role_id;

  -- Check if role exists
  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  -- Check if any admin users have this role
  SELECT COUNT(*)
  INTO v_member_count
  FROM admin_users
  WHERE role = v_role_name;

  IF v_member_count > 0 THEN
    RAISE EXCEPTION '% member(s) currently have this role. Please reassign them first.', v_member_count;
  END IF;

  -- Delete from custom_roles table
  DELETE FROM custom_roles
  WHERE id = p_role_id;

  -- Log the action in admin_audit_logs
  INSERT INTO admin_audit_logs (
    action,
    performed_by,
    details,
    admin_user_id
  ) VALUES (
    'role_deleted',
    auth.uid(),
    jsonb_build_object(
      'role_id', p_role_id,
      'role_name', v_role_name
    ),
    auth.uid()
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_custom_role(uuid) TO authenticated;