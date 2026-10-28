-- Fix team management functions - replace p.email with proper auth.users email retrieval

-- 1. Fix remove_team_member function
DROP FUNCTION IF EXISTS public.remove_team_member(uuid);

CREATE OR REPLACE FUNCTION public.remove_team_member(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
  v_target_role text;
  v_admin_email text;
  v_admin_name text;
  v_target_email text;
  v_client_ip text;
  v_owner_count int;
BEGIN
  -- Check authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prevent self-removal
  IF auth.uid() = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself from the team';
  END IF;

  -- Get admin info with email from auth.users
  SELECT 
    au.role,
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    COALESCE(p.full_name, 'Admin'),
    inet_client_addr()::text
  INTO v_admin_role, v_admin_email, v_admin_name, v_client_ip
  FROM admin_users au
  LEFT JOIN profiles p ON p.user_id = auth.uid()
  WHERE au.user_id = auth.uid();

  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Get target user info with email from auth.users
  SELECT 
    au.role,
    (SELECT email FROM auth.users WHERE id = p_target_user_id)
  INTO v_target_role, v_target_email
  FROM admin_users au
  WHERE au.user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not an admin';
  END IF;

  -- Role hierarchy check
  IF NOT check_role_hierarchy(v_admin_role, v_target_role) THEN
    RAISE EXCEPTION 'You cannot remove users with a higher role than yours';
  END IF;

  -- Prevent removing the last owner
  IF v_target_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM admin_users
    WHERE role = 'owner';
    
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner. At least one owner must remain.';
    END IF;
  END IF;

  -- Remove from admin tables
  DELETE FROM admin_permissions WHERE user_id = p_target_user_id;
  DELETE FROM admin_users WHERE user_id = p_target_user_id;

  -- Log the action
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
    'remove_member',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'removed_role', v_target_role,
      'removed_by', v_admin_email
    ),
    v_client_ip
  );
END;
$$;

-- 2. Fix assign_role_to_user function
DROP FUNCTION IF EXISTS public.assign_role_to_user(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.assign_role_to_user(
  p_target_user_id uuid,
  p_role text,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
  v_admin_email text;
  v_admin_name text;
  v_target_email text;
  v_client_ip text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get admin info
  SELECT 
    au.role,
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    COALESCE(p.full_name, 'Admin'),
    inet_client_addr()::text
  INTO v_admin_role, v_admin_email, v_admin_name, v_client_ip
  FROM admin_users au
  LEFT JOIN profiles p ON p.user_id = auth.uid()
  WHERE au.user_id = auth.uid();

  IF v_admin_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;

  IF NOT check_role_hierarchy(v_admin_role, p_role) THEN
    RAISE EXCEPTION 'You cannot assign a role higher than your own';
  END IF;

  -- Check if user already has admin role
  IF EXISTS (SELECT 1 FROM admin_users WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'User already has an admin role';
  END IF;

  -- Get target user email
  SELECT email INTO v_target_email
  FROM auth.users
  WHERE id = p_target_user_id;

  -- Insert admin user
  INSERT INTO admin_users (user_id, role, created_by)
  VALUES (p_target_user_id, p_role, auth.uid());

  -- Insert permissions
  INSERT INTO admin_permissions (user_id, permissions)
  VALUES (p_target_user_id, p_permissions);

  -- Log action
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
    'assign_role',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'assigned_role', p_role,
      'permissions', p_permissions
    ),
    v_client_ip
  );
END;
$$;

-- 3. Fix update_team_member_permissions function
DROP FUNCTION IF EXISTS public.update_team_member_permissions(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.update_team_member_permissions(
  p_target_user_id uuid,
  p_permissions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
  v_target_role text;
  v_admin_email text;
  v_admin_name text;
  v_target_email text;
  v_client_ip text;
  v_old_permissions jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get admin info
  SELECT 
    au.role,
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    COALESCE(p.full_name, 'Admin'),
    inet_client_addr()::text
  INTO v_admin_role, v_admin_email, v_admin_name, v_client_ip
  FROM admin_users au
  LEFT JOIN profiles p ON p.user_id = auth.uid()
  WHERE au.user_id = auth.uid();

  IF v_admin_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only admins can update permissions';
  END IF;

  -- Get target role and email
  SELECT 
    au.role,
    (SELECT email FROM auth.users WHERE id = p_target_user_id)
  INTO v_target_role, v_target_email
  FROM admin_users au
  WHERE au.user_id = p_target_user_id;

  IF NOT check_role_hierarchy(v_admin_role, v_target_role) THEN
    RAISE EXCEPTION 'You cannot modify permissions for users with a higher role than yours';
  END IF;

  -- Get old permissions
  SELECT permissions INTO v_old_permissions
  FROM admin_permissions
  WHERE user_id = p_target_user_id;

  -- Update permissions
  UPDATE admin_permissions
  SET permissions = p_permissions, updated_at = now()
  WHERE user_id = p_target_user_id;

  -- Log action
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
    'update_permissions',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'old_permissions', v_old_permissions,
      'new_permissions', p_permissions
    ),
    v_client_ip
  );
END;
$$;

-- 4. Fix change_team_member_role function
DROP FUNCTION IF EXISTS public.change_team_member_role(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.change_team_member_role(
  p_target_user_id uuid,
  p_new_role text,
  p_preserve_custom_permissions boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
  v_old_role text;
  v_admin_email text;
  v_admin_name text;
  v_target_email text;
  v_client_ip text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get admin info
  SELECT 
    au.role,
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    COALESCE(p.full_name, 'Admin'),
    inet_client_addr()::text
  INTO v_admin_role, v_admin_email, v_admin_name, v_client_ip
  FROM admin_users au
  LEFT JOIN profiles p ON p.user_id = auth.uid()
  WHERE au.user_id = auth.uid();

  IF v_admin_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;

  -- Get old role and target email
  SELECT 
    au.role,
    (SELECT email FROM auth.users WHERE id = p_target_user_id)
  INTO v_old_role, v_target_email
  FROM admin_users au
  WHERE au.user_id = p_target_user_id;

  IF NOT check_role_hierarchy(v_admin_role, v_old_role) OR NOT check_role_hierarchy(v_admin_role, p_new_role) THEN
    RAISE EXCEPTION 'You cannot modify users with a higher role or assign roles higher than yours';
  END IF;

  -- Update role
  UPDATE admin_users
  SET role = p_new_role, updated_at = now()
  WHERE user_id = p_target_user_id;

  -- Update permissions if not preserving
  IF NOT p_preserve_custom_permissions THEN
    UPDATE admin_permissions
    SET permissions = get_default_permissions_for_role(p_new_role),
        updated_at = now()
    WHERE user_id = p_target_user_id;
  END IF;

  -- Log action
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
    'change_role',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'old_role', v_old_role,
      'new_role', p_new_role,
      'preserved_permissions', p_preserve_custom_permissions
    ),
    v_client_ip
  );
END;
$$;

-- 5. Fix create_custom_role function
DROP FUNCTION IF EXISTS public.create_custom_role(text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_custom_role(
  p_role_name text,
  p_role_description text,
  p_permissions jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role text;
  v_admin_email text;
  v_admin_name text;
  v_client_ip text;
  v_new_role_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get admin info
  SELECT 
    au.role,
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    COALESCE(p.full_name, 'Admin'),
    inet_client_addr()::text
  INTO v_admin_role, v_admin_email, v_admin_name, v_client_ip
  FROM admin_users au
  LEFT JOIN profiles p ON p.user_id = auth.uid()
  WHERE au.user_id = auth.uid();

  IF v_admin_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Only admins can create custom roles';
  END IF;

  -- Insert custom role
  INSERT INTO team_roles (
    role_name,
    role_description,
    base_permissions,
    is_custom,
    created_by
  ) VALUES (
    p_role_name,
    p_role_description,
    p_permissions,
    true,
    auth.uid()
  )
  RETURNING id INTO v_new_role_id;

  -- Log action
  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    admin_name,
    action_type,
    changes,
    ip_address
  ) VALUES (
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'create_custom_role',
    jsonb_build_object(
      'role_name', p_role_name,
      'role_description', p_role_description,
      'permissions', p_permissions
    ),
    v_client_ip
  );

  RETURN v_new_role_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_role_to_user(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_team_member_permissions(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_team_member_role(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_role(text, text, jsonb) TO authenticated;