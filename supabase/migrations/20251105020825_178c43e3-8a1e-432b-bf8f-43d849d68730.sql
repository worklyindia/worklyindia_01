-- Fix all functions to use correct table name: admin_audit_logs (not admin_audit_log)

-- 1. Fix assign_role_to_user function
DROP FUNCTION IF EXISTS public.assign_role_to_user(uuid, text, jsonb, text);

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
  v_admin_name text;
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

  -- Get emails from auth.users
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  
  -- Get admin name from profiles
  SELECT full_name INTO v_admin_name FROM profiles WHERE user_id = v_admin_user_id;

  -- Insert into admin_users
  INSERT INTO admin_users (user_id, role)
  VALUES (p_target_user_id, p_role);

  -- Insert permissions
  INSERT INTO admin_permissions (user_id, permissions)
  VALUES (p_target_user_id, p_permissions);

  -- FIXED: Log to admin_audit_logs (with 's')
  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    logged_at
  ) VALUES (
    v_admin_user_id,
    v_admin_email,
    v_admin_name,
    'assign_role',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'role', p_role,
      'permissions', p_permissions
    ),
    p_ip_address,
    now()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_role_to_user(uuid, text, jsonb, text) TO authenticated;

-- 2. Fix remove_team_member function
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
  v_admin_email text;
  v_admin_name text;
  v_target_email text;
  v_owner_count int;
BEGIN
  -- Get authenticated user
  v_admin_user_id := auth.uid();
  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prevent self-removal
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

  -- Role hierarchy check
  IF v_admin_role = 'admin' AND v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Admins cannot remove owners';
  END IF;

  -- Check if this is the last owner
  SELECT COUNT(*) INTO v_owner_count FROM admin_users WHERE role = 'owner';
  IF v_target_role = 'owner' AND v_owner_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last owner. At least one owner must remain.';
  END IF;

  -- Get emails from auth.users
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  
  -- Get admin name from profiles
  SELECT full_name INTO v_admin_name FROM profiles WHERE user_id = v_admin_user_id;

  -- Delete permissions first (foreign key constraint)
  DELETE FROM admin_permissions WHERE user_id = p_target_user_id;

  -- Delete from admin_users
  DELETE FROM admin_users WHERE user_id = p_target_user_id;

  -- FIXED: Log to admin_audit_logs (with 's')
  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    logged_at
  ) VALUES (
    v_admin_user_id,
    v_admin_email,
    v_admin_name,
    'remove_team_member',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'removed_role', v_target_role
    ),
    p_ip_address,
    now()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, text) TO authenticated;

-- 3. Fix update_team_member_permissions function
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
  v_admin_name text;
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

  -- Get old permissions
  SELECT permissions INTO v_old_permissions FROM admin_permissions WHERE user_id = p_target_user_id;

  -- Get emails from auth.users
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  
  -- Get admin name from profiles
  SELECT full_name INTO v_admin_name FROM profiles WHERE user_id = v_admin_user_id;

  -- Update permissions
  UPDATE admin_permissions 
  SET permissions = p_permissions,
      updated_at = now()
  WHERE user_id = p_target_user_id;

  -- FIXED: Log to admin_audit_logs (with 's')
  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    logged_at
  ) VALUES (
    v_admin_user_id,
    v_admin_email,
    v_admin_name,
    'update_permissions',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'old_permissions', v_old_permissions,
      'new_permissions', p_permissions
    ),
    p_ip_address,
    now()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_team_member_permissions(uuid, jsonb, text) TO authenticated;

-- 4. Fix change_team_member_role function
DROP FUNCTION IF EXISTS public.change_team_member_role(uuid, text, boolean, text);

CREATE OR REPLACE FUNCTION public.change_team_member_role(
  p_target_user_id uuid,
  p_new_role text,
  p_preserve_custom_permissions boolean DEFAULT false,
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
  v_admin_name text;
  v_target_email text;
  v_owner_count int;
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

  -- Role hierarchy checks
  IF v_admin_role = 'admin' AND (v_old_role = 'owner' OR p_new_role = 'owner') THEN
    RAISE EXCEPTION 'Admins cannot modify owner roles or assign owner role';
  END IF;

  -- Check if removing last owner
  IF v_old_role = 'owner' AND p_new_role != 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count FROM admin_users WHERE role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot change role of the last owner';
    END IF;
  END IF;

  -- Get emails from auth.users
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  
  -- Get admin name from profiles
  SELECT full_name INTO v_admin_name FROM profiles WHERE user_id = v_admin_user_id;

  -- Update role
  UPDATE admin_users SET role = p_new_role WHERE user_id = p_target_user_id;

  -- Reset permissions if not preserving
  IF NOT p_preserve_custom_permissions THEN
    UPDATE admin_permissions 
    SET permissions = '{}'::jsonb,
        updated_at = now()
    WHERE user_id = p_target_user_id;
  END IF;

  -- FIXED: Log to admin_audit_logs (with 's')
  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    logged_at
  ) VALUES (
    v_admin_user_id,
    v_admin_email,
    v_admin_name,
    'change_role',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'old_role', v_old_role,
      'new_role', p_new_role,
      'preserved_permissions', p_preserve_custom_permissions
    ),
    p_ip_address,
    now()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_team_member_role(uuid, text, boolean, text) TO authenticated;

-- 5. Fix create_custom_role function
DROP FUNCTION IF EXISTS public.create_custom_role(text, text, jsonb, text);

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
  v_admin_name text;
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

  -- Get admin email from auth.users
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
  
  -- Get admin name from profiles
  SELECT full_name INTO v_admin_name FROM profiles WHERE user_id = v_admin_user_id;

  -- Create the custom role
  INSERT INTO team_roles (role_name, role_description, base_permissions, is_custom, created_by)
  VALUES (p_role_name, p_role_description, p_permissions, true, v_admin_user_id)
  RETURNING id INTO v_new_role_id;

  -- FIXED: Log to admin_audit_logs (with 's')
  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    logged_at
  ) VALUES (
    v_admin_user_id,
    v_admin_email,
    v_admin_name,
    'create_custom_role',
    NULL,
    NULL,
    jsonb_build_object(
      'role_id', v_new_role_id,
      'role_name', p_role_name,
      'role_description', p_role_description,
      'permissions', p_permissions
    ),
    p_ip_address,
    now()
  );

  RETURN jsonb_build_object('success', true, 'role_id', v_new_role_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_custom_role(text, text, jsonb, text) TO authenticated;