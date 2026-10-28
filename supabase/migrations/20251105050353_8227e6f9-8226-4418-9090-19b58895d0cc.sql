-- Fix delete_custom_role function to delete from correct table
-- This fixes the "cannot delete from view 'team_roles'" error

DROP FUNCTION IF EXISTS public.delete_custom_role(uuid);

CREATE OR REPLACE FUNCTION public.delete_custom_role(p_role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
  v_is_custom boolean;
  v_member_count integer;
  v_user_role text;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user has permission (must be owner or admin)
  SELECT role INTO v_user_role
  FROM team_members
  WHERE user_id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only owners and admins can delete custom roles';
  END IF;

  -- Get role details from the actual table (not view)
  SELECT role_name, is_custom
  INTO v_role_name, v_is_custom
  FROM team_role_definitions
  WHERE id = p_role_id;

  -- Check if role exists
  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  -- Prevent deletion of system roles
  IF v_is_custom = false THEN
    RAISE EXCEPTION 'Cannot delete system roles (admin, owner, moderator, support)';
  END IF;

  -- Check if any members have this role
  SELECT COUNT(*)
  INTO v_member_count
  FROM team_members
  WHERE role = v_role_name;

  IF v_member_count > 0 THEN
    RAISE EXCEPTION '% member(s) currently have this role. Please reassign them first.', v_member_count;
  END IF;

  -- Delete from the actual table
  DELETE FROM team_role_definitions
  WHERE id = p_role_id AND is_custom = true;

  -- Log the action
  INSERT INTO audit_logs (
    user_id,
    action_type,
    details,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    'role_deleted',
    jsonb_build_object(
      'role_id', p_role_id,
      'role_name', v_role_name
    ),
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_custom_role(uuid) TO authenticated;