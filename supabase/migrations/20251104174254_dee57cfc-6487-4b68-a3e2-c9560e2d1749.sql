-- Fix all team management functions to retrieve email from auth.users instead of profiles
-- This fixes the "column 'email' does not exist" error across all team operations

-- 1. Fix remove_team_member
DROP FUNCTION IF EXISTS public.remove_team_member(uuid, text);

CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_target_user_id uuid,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id uuid;
  v_admin_role text;
  v_target_role text;
  v_owner_count int;
  v_admin_email text;
  v_target_email text;
BEGIN
  -- Get authenticated user
  v_admin_user_id := auth.uid();
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if admin trying to remove themselves
  IF v_admin_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself from the team';
  END IF;

  -- Get admin role
  SELECT role INTO v_admin_role FROM admin_users WHERE user_id = v_admin_user_id;
  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and owners can remove team members';
  END IF;

  -- Get target role
  SELECT role INTO v_target_role FROM admin_users WHERE user_id = p_target_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a team member';
  END IF;

  -- Role hierarchy check: admins cannot remove owners
  IF v_admin_role = 'admin' AND v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Admins cannot remove owners';
  END IF;

  -- Prevent removing last owner
  IF v_target_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count FROM admin_users WHERE role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner';
    END IF;
  END IF;

  -- FIX: Get emails from auth.users instead of profiles
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;

  -- Delete from admin_permissions
  DELETE FROM admin_permissions WHERE user_id = p_target_user_id;

  -- Delete from admin_users
  DELETE FROM admin_users WHERE user_id = p_target_user_id;

  -- Log the action
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_user_id,
    changes,
    ip_address
  ) VALUES (
    v_admin_user_id,
    'remove_team_member',
    p_target_user_id,
    jsonb_build_object(
      'removed_role', v_target_role,
      'admin_email', v_admin_email,
      'target_email', v_target_email
    ),
    p_ip_address
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Fix update_team_member_permissions
DROP FUNCTION IF EXISTS public.update_team_member_permissions(uuid, jsonb, text);

CREATE OR REPLACE FUNCTION public.update_team_member_permissions(
  p_target_user_id uuid,
  p_permissions jsonb,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id uuid;
  v_admin_role text;
  v_target_role text;
  v_admin_email text;
  v_target_email text;
  v_old_permissions jsonb;
BEGIN
  -- Get authenticated user
  v_admin_user_id := auth.uid();
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get admin role
  SELECT role INTO v_admin_role FROM admin_users WHERE user_id = v_admin_user_id;
  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and owners can update permissions';
  END IF;

  -- Get target role
  SELECT role INTO v_target_role FROM admin_users WHERE user_id = p_target_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a team member';
  END IF;

  -- Role hierarchy check
  IF v_admin_role = 'admin' AND v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Admins cannot modify owner permissions';
  END IF;

  -- Get old permissions and emails
  SELECT permissions INTO v_old_permissions FROM admin_permissions WHERE user_id = p_target_user_id;
  -- FIX: Get emails from auth.users instead of profiles
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;

  -- Update permissions
  UPDATE admin_permissions
  SET permissions = p_permissions, updated_at = now()
  WHERE user_id = p_target_user_id;

  -- If no row was updated, insert new permissions
  IF NOT FOUND THEN
    INSERT INTO admin_permissions (user_id, permissions)
    VALUES (p_target_user_id, p_permissions);
  END IF;

  -- Log the action
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_user_id,
    changes,
    ip_address
  ) VALUES (
    v_admin_user_id,
    'update_permissions',
    p_target_user_id,
    jsonb_build_object(
      'old_permissions', v_old_permissions,
      'new_permissions', p_permissions,
      'admin_email', v_admin_email,
      'target_email', v_target_email
    ),
    p_ip_address
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Fix change_team_member_role
DROP FUNCTION IF EXISTS public.change_team_member_role(uuid, text, text);

CREATE OR REPLACE FUNCTION public.change_team_member_role(
  p_target_user_id uuid,
  p_new_role text,
  p_ip_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_user_id uuid;
  v_admin_role text;
  v_old_role text;
  v_admin_email text;
  v_target_email text;
BEGIN
  -- Get authenticated user
  v_admin_user_id := auth.uid();
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get admin role
  SELECT role INTO v_admin_role FROM admin_users WHERE user_id = v_admin_user_id;
  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and owners can change roles';
  END IF;

  -- Get old role
  SELECT role INTO v_old_role FROM admin_users WHERE user_id = p_target_user_id;
  IF v_old_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a team member';
  END IF;

  -- Role hierarchy check
  IF v_admin_role = 'admin' AND (v_old_role = 'owner' OR p_new_role = 'owner') THEN
    RAISE EXCEPTION 'Admins cannot modify owner roles';
  END IF;

  -- FIX: Get emails from auth.users instead of profiles
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;

  -- Update role
  UPDATE admin_users
  SET role = p_new_role, updated_at = now()
  WHERE user_id = p_target_user_id;

  -- Log the action
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_user_id,
    changes,
    ip_address
  ) VALUES (
    v_admin_user_id,
    'change_role',
    p_target_user_id,
    jsonb_build_object(
      'old_role', v_old_role,
      'new_role', p_new_role,
      'admin_email', v_admin_email,
      'target_email', v_target_email
    ),
    p_ip_address
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member_permissions(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_team_member_role(uuid, text, text) TO authenticated;