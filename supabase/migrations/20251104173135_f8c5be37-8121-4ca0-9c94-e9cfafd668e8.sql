-- ============================================================================
-- Fix Function Overloading Conflicts - Team Management Functions
-- ============================================================================
-- This migration resolves "could not choose the best candidate function" errors
-- by explicitly dropping all versions of conflicting functions and recreating
-- them with the correct signatures.
-- ============================================================================

-- Step 1: Drop ALL versions of conflicting functions
-- We need to explicitly specify signatures to drop all overloaded versions

DROP FUNCTION IF EXISTS public.remove_team_member(uuid);
DROP FUNCTION IF EXISTS public.remove_team_member(uuid, text);
DROP FUNCTION IF EXISTS public.remove_team_member(p_target_user_id uuid);
DROP FUNCTION IF EXISTS public.remove_team_member(p_target_user_id uuid, p_ip_address text);

DROP FUNCTION IF EXISTS public.assign_role_to_user(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.assign_role_to_user(uuid, text, jsonb, text);
DROP FUNCTION IF EXISTS public.assign_role_to_user(p_target_user_id uuid, p_role text, p_permissions jsonb);
DROP FUNCTION IF EXISTS public.assign_role_to_user(p_target_user_id uuid, p_role text, p_permissions jsonb, p_ip_address text);

DROP FUNCTION IF EXISTS public.update_team_member_permissions(uuid, jsonb);
DROP FUNCTION IF EXISTS public.update_team_member_permissions(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.update_team_member_permissions(p_target_user_id uuid, p_permissions jsonb);
DROP FUNCTION IF EXISTS public.update_team_member_permissions(p_target_user_id uuid, p_permissions jsonb, p_ip_address text);

DROP FUNCTION IF EXISTS public.change_team_member_role(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.change_team_member_role(uuid, text, boolean, text);
DROP FUNCTION IF EXISTS public.change_team_member_role(p_target_user_id uuid, p_new_role text, p_preserve_custom_permissions boolean);
DROP FUNCTION IF EXISTS public.change_team_member_role(p_target_user_id uuid, p_new_role text, p_preserve_custom_permissions boolean, p_ip_address text);

DROP FUNCTION IF EXISTS public.create_custom_role(text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_custom_role(text, text, jsonb, text);
DROP FUNCTION IF EXISTS public.create_custom_role(p_role_name text, p_role_description text, p_permissions jsonb);
DROP FUNCTION IF EXISTS public.create_custom_role(p_role_name text, p_role_description text, p_permissions jsonb, p_ip_address text);

-- Step 2: Recreate functions with correct signatures (ip_address optional with DEFAULT NULL)

-- Remove team member function
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

  -- Get emails for audit log
  SELECT email INTO v_admin_email FROM profiles WHERE user_id = v_admin_user_id;
  SELECT email INTO v_target_email FROM profiles WHERE user_id = p_target_user_id;

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

-- Assign role to user function
CREATE OR REPLACE FUNCTION public.assign_role_to_user(
  p_target_user_id uuid,
  p_role text,
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
    RAISE EXCEPTION 'Unauthorized: Only admins and owners can assign roles';
  END IF;

  -- Role hierarchy check
  IF v_admin_role = 'admin' AND p_role = 'owner' THEN
    RAISE EXCEPTION 'Admins cannot assign owner role';
  END IF;

  -- Check if user already has an admin role
  IF EXISTS (SELECT 1 FROM admin_users WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'User already has an admin role';
  END IF;

  -- Get emails for audit log
  SELECT email INTO v_admin_email FROM profiles WHERE user_id = v_admin_user_id;
  SELECT email INTO v_target_email FROM profiles WHERE user_id = p_target_user_id;

  -- Insert into admin_users
  INSERT INTO admin_users (user_id, role)
  VALUES (p_target_user_id, p_role);

  -- Insert permissions
  INSERT INTO admin_permissions (user_id, permissions)
  VALUES (p_target_user_id, p_permissions);

  -- Log the action
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_user_id,
    changes,
    ip_address
  ) VALUES (
    v_admin_user_id,
    'assign_role',
    p_target_user_id,
    jsonb_build_object(
      'role', p_role,
      'permissions', p_permissions,
      'admin_email', v_admin_email,
      'target_email', v_target_email
    ),
    p_ip_address
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Update team member permissions function
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
  SELECT email INTO v_admin_email FROM profiles WHERE user_id = v_admin_user_id;
  SELECT email INTO v_target_email FROM profiles WHERE user_id = p_target_user_id;

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

-- Change team member role function
CREATE OR REPLACE FUNCTION public.change_team_member_role(
  p_target_user_id uuid,
  p_new_role text,
  p_preserve_custom_permissions boolean,
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

  -- Get emails
  SELECT email INTO v_admin_email FROM profiles WHERE user_id = v_admin_user_id;
  SELECT email INTO v_target_email FROM profiles WHERE user_id = p_target_user_id;

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

-- Create custom role function
CREATE OR REPLACE FUNCTION public.create_custom_role(
  p_role_name text,
  p_role_description text,
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
  v_admin_email text;
  v_new_role_id uuid;
BEGIN
  -- Get authenticated user
  v_admin_user_id := auth.uid();
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get admin role
  SELECT role INTO v_admin_role FROM admin_users WHERE user_id = v_admin_user_id;
  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and owners can create custom roles';
  END IF;

  -- Get admin email
  SELECT email INTO v_admin_email FROM profiles WHERE user_id = v_admin_user_id;

  -- Insert custom role
  INSERT INTO team_roles (role_name, role_description, base_permissions, is_custom, created_by)
  VALUES (p_role_name, p_role_description, p_permissions, true, v_admin_user_id)
  RETURNING id INTO v_new_role_id;

  -- Log the action
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    changes,
    ip_address
  ) VALUES (
    v_admin_user_id,
    'create_custom_role',
    jsonb_build_object(
      'role_name', p_role_name,
      'role_description', p_role_description,
      'permissions', p_permissions,
      'admin_email', v_admin_email
    ),
    p_ip_address
  );

  RETURN jsonb_build_object('success', true, 'role_id', v_new_role_id);
END;
$$;

-- Step 3: Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_role_to_user(uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member_permissions(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_team_member_role(uuid, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_role(text, text, jsonb, text) TO authenticated;