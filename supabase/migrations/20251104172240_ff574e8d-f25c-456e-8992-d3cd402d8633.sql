-- Fix admin_audit_logs INSERT statements in team management functions
-- Add the required 'action' column to all audit log inserts

-- Drop existing functions
DROP FUNCTION IF EXISTS public.remove_team_member(UUID, TEXT);
DROP FUNCTION IF EXISTS public.assign_role_to_user(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_team_member_permissions(UUID, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.change_team_member_role(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_custom_role(TEXT, JSONB, TEXT);

-- Recreate remove_team_member with fixed audit log
CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_target_user_id UUID,
  p_ip_address TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role TEXT;
  v_target_role TEXT;
  v_admin_email TEXT;
  v_target_email TEXT;
  v_admin_name TEXT;
  v_target_name TEXT;
  v_client_ip TEXT;
BEGIN
  v_client_ip := COALESCE(p_ip_address, current_setting('request.headers', true)::json->>'x-forwarded-for');

  SELECT au.role INTO v_admin_role
  FROM admin_users au
  WHERE au.user_id = auth.uid();

  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Not an admin user';
  END IF;

  SELECT au.role INTO v_target_role
  FROM admin_users au
  WHERE au.user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not an admin';
  END IF;

  IF NOT check_role_hierarchy(v_admin_role, v_target_role) THEN
    RAISE EXCEPTION 'Insufficient permissions: Cannot remove user with role %', v_target_role;
  END IF;

  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  
  SELECT COALESCE(full_name, email) INTO v_admin_name FROM profiles WHERE user_id = auth.uid();
  SELECT COALESCE(full_name, email) INTO v_target_name FROM profiles WHERE user_id = p_target_user_id;

  DELETE FROM admin_permissions WHERE user_id = p_target_user_id;
  DELETE FROM admin_users WHERE user_id = p_target_user_id;

  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    performed_by
  ) VALUES (
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'remove_member',
    'remove_member',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'removed_role', v_target_role,
      'removed_user_name', v_target_name
    ),
    v_client_ip,
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Team member removed successfully');
END;
$$;

-- Recreate assign_role_to_user with fixed audit log
CREATE OR REPLACE FUNCTION public.assign_role_to_user(
  p_target_user_id UUID,
  p_role TEXT,
  p_ip_address TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role TEXT;
  v_admin_email TEXT;
  v_target_email TEXT;
  v_admin_name TEXT;
  v_client_ip TEXT;
BEGIN
  v_client_ip := COALESCE(p_ip_address, current_setting('request.headers', true)::json->>'x-forwarded-for');

  SELECT au.role INTO v_admin_role
  FROM admin_users au
  WHERE au.user_id = auth.uid();

  IF v_admin_role IS NULL OR v_admin_role != 'owner' THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can assign roles';
  END IF;

  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  SELECT COALESCE(full_name, email) INTO v_admin_name FROM profiles WHERE user_id = auth.uid();

  INSERT INTO admin_users (user_id, role, created_by)
  VALUES (p_target_user_id, p_role, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET role = p_role, updated_at = now();

  INSERT INTO admin_permissions (user_id, permissions)
  VALUES (p_target_user_id, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    performed_by
  ) VALUES (
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'assign_role',
    'assign_role',
    p_target_user_id,
    v_target_email,
    jsonb_build_object('new_role', p_role),
    v_client_ip,
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Role assigned successfully');
END;
$$;

-- Recreate update_team_member_permissions with fixed audit log
CREATE OR REPLACE FUNCTION public.update_team_member_permissions(
  p_target_user_id UUID,
  p_permissions JSONB,
  p_ip_address TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role TEXT;
  v_target_role TEXT;
  v_admin_email TEXT;
  v_target_email TEXT;
  v_admin_name TEXT;
  v_old_permissions JSONB;
  v_client_ip TEXT;
BEGIN
  v_client_ip := COALESCE(p_ip_address, current_setting('request.headers', true)::json->>'x-forwarded-for');

  SELECT au.role INTO v_admin_role
  FROM admin_users au
  WHERE au.user_id = auth.uid();

  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Not an admin user';
  END IF;

  SELECT au.role INTO v_target_role
  FROM admin_users au
  WHERE au.user_id = p_target_user_id;

  IF NOT check_role_hierarchy(v_admin_role, v_target_role) THEN
    RAISE EXCEPTION 'Insufficient permissions: Cannot update permissions for role %', v_target_role;
  END IF;

  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  SELECT COALESCE(full_name, email) INTO v_admin_name FROM profiles WHERE user_id = auth.uid();

  SELECT permissions INTO v_old_permissions
  FROM admin_permissions
  WHERE user_id = p_target_user_id;

  UPDATE admin_permissions
  SET permissions = p_permissions, updated_at = now()
  WHERE user_id = p_target_user_id;

  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    performed_by
  ) VALUES (
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'update_permissions',
    'update_permissions',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'old_permissions', v_old_permissions,
      'new_permissions', p_permissions
    ),
    v_client_ip,
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Permissions updated successfully');
END;
$$;

-- Recreate change_team_member_role with fixed audit log
CREATE OR REPLACE FUNCTION public.change_team_member_role(
  p_target_user_id UUID,
  p_new_role TEXT,
  p_ip_address TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role TEXT;
  v_old_role TEXT;
  v_admin_email TEXT;
  v_target_email TEXT;
  v_admin_name TEXT;
  v_client_ip TEXT;
BEGIN
  v_client_ip := COALESCE(p_ip_address, current_setting('request.headers', true)::json->>'x-forwarded-for');

  SELECT au.role INTO v_admin_role
  FROM admin_users au
  WHERE au.user_id = auth.uid();

  IF v_admin_role != 'owner' THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can change roles';
  END IF;

  SELECT au.role INTO v_old_role
  FROM admin_users au
  WHERE au.user_id = p_target_user_id;

  IF v_old_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not an admin';
  END IF;

  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  SELECT COALESCE(full_name, email) INTO v_admin_name FROM profiles WHERE user_id = auth.uid();

  UPDATE admin_users
  SET role = p_new_role, updated_at = now()
  WHERE user_id = p_target_user_id;

  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    performed_by
  ) VALUES (
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'change_role',
    'change_role',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'old_role', v_old_role,
      'new_role', p_new_role
    ),
    v_client_ip,
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Role changed successfully');
END;
$$;

-- Recreate create_custom_role with fixed audit log
CREATE OR REPLACE FUNCTION public.create_custom_role(
  p_role_name TEXT,
  p_permissions JSONB,
  p_ip_address TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role TEXT;
  v_admin_email TEXT;
  v_admin_name TEXT;
  v_client_ip TEXT;
BEGIN
  v_client_ip := COALESCE(p_ip_address, current_setting('request.headers', true)::json->>'x-forwarded-for');

  SELECT au.role INTO v_admin_role
  FROM admin_users au
  WHERE au.user_id = auth.uid();

  IF v_admin_role != 'owner' THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can create custom roles';
  END IF;

  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT COALESCE(full_name, email) INTO v_admin_name FROM profiles WHERE user_id = auth.uid();

  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action,
    action_type,
    target_user_id,
    target_email,
    changes,
    ip_address,
    performed_by
  ) VALUES (
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'create_custom_role',
    'create_custom_role',
    NULL,
    NULL,
    jsonb_build_object(
      'role_name', p_role_name,
      'permissions', p_permissions
    ),
    v_client_ip,
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Custom role created successfully');
END;
$$;

-- Grant execution rights
GRANT EXECUTE ON FUNCTION public.remove_team_member(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_role_to_user(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member_permissions(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_team_member_role(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_role(TEXT, JSONB, TEXT) TO authenticated;