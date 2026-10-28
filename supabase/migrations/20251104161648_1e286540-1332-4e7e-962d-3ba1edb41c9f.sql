-- ============================================================================
-- FIX: Replace incorrect 'details' column with 'changes' in admin_activity_log
-- ============================================================================

-- Fix assign_role_to_user function
CREATE OR REPLACE FUNCTION public.assign_role_to_user(
  p_target_user_id uuid,
  p_role text,
  p_permissions jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_admin_name text;
  v_target_email text;
  v_client_ip text;
BEGIN
  -- Check if caller is owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can assign roles';
  END IF;

  -- Get admin details for audit log
  SELECT p.email, p.full_name, inet_client_addr()::text
  INTO v_admin_email, v_admin_name, v_client_ip
  FROM profiles p
  WHERE p.id = auth.uid();

  -- Get target user email
  SELECT p.email INTO v_target_email
  FROM profiles p
  WHERE p.id = p_target_user_id;

  -- Insert or update admin_users
  INSERT INTO admin_users (user_id, role)
  VALUES (p_target_user_id, p_role)
  ON CONFLICT (user_id) 
  DO UPDATE SET role = p_role, updated_at = now();

  -- Insert or update permissions if provided
  IF p_permissions IS NOT NULL AND p_permissions::text != '{}'::text THEN
    INSERT INTO admin_permissions (user_id, permissions)
    VALUES (p_target_user_id, p_permissions)
    ON CONFLICT (user_id)
    DO UPDATE SET permissions = p_permissions, updated_at = now();
  END IF;

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
    'assign_role',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'role', p_role,
      'permissions', p_permissions
    ),
    v_client_ip
  );

  -- Log to activity log (FIXED: changed 'details' to 'changes')
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    changes
  ) VALUES (
    auth.uid(),
    'assign_role',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'role', p_role
    )
  );
END;
$$;

-- Fix update_team_member_permissions function
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
  v_admin_email text;
  v_admin_name text;
  v_target_email text;
  v_old_permissions jsonb;
  v_client_ip text;
BEGIN
  -- Check if caller is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update permissions';
  END IF;

  -- Get old permissions
  SELECT permissions INTO v_old_permissions
  FROM admin_permissions
  WHERE user_id = p_target_user_id;

  -- Get admin details
  SELECT p.email, p.full_name, inet_client_addr()::text
  INTO v_admin_email, v_admin_name, v_client_ip
  FROM profiles p
  WHERE p.id = auth.uid();

  -- Get target user email
  SELECT p.email INTO v_target_email
  FROM profiles p
  WHERE p.id = p_target_user_id;

  -- Update permissions
  INSERT INTO admin_permissions (user_id, permissions)
  VALUES (p_target_user_id, p_permissions)
  ON CONFLICT (user_id)
  DO UPDATE SET permissions = p_permissions, updated_at = now();

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
    'update_permissions',
    p_target_user_id,
    v_target_email,
    jsonb_build_object(
      'old_permissions', v_old_permissions,
      'new_permissions', p_permissions
    ),
    v_client_ip
  );

  -- Log to activity log (FIXED: changed 'details' to 'changes')
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    changes
  ) VALUES (
    auth.uid(),
    'update_permissions',
    jsonb_build_object(
      'target_user_id', p_target_user_id
    )
  );
END;
$$;

-- Fix remove_team_member function
CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_admin_name text;
  v_target_email text;
  v_target_role text;
  v_owner_count int;
  v_client_ip text;
BEGIN
  -- Check if caller is owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can remove team members';
  END IF;

  -- Prevent self-removal
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;

  -- Get target role
  SELECT role INTO v_target_role
  FROM admin_users
  WHERE user_id = p_target_user_id;

  -- Check if removing last owner
  IF v_target_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count
    FROM admin_users
    WHERE role = 'owner';
    
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner';
    END IF;
  END IF;

  -- Get admin and target details
  SELECT p.email, p.full_name, inet_client_addr()::text
  INTO v_admin_email, v_admin_name, v_client_ip
  FROM profiles p
  WHERE p.id = auth.uid();

  SELECT p.email INTO v_target_email
  FROM profiles p
  WHERE p.id = p_target_user_id;

  -- Delete permissions first (foreign key constraint)
  DELETE FROM admin_permissions WHERE user_id = p_target_user_id;
  
  -- Delete admin user
  DELETE FROM admin_users WHERE user_id = p_target_user_id;

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
    'remove_team_member',
    p_target_user_id,
    v_target_email,
    jsonb_build_object('role', v_target_role),
    v_client_ip
  );

  -- Log to activity log (FIXED: changed 'details' to 'changes')
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    changes
  ) VALUES (
    auth.uid(),
    'remove_team_member',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'role', v_target_role
    )
  );
END;
$$;

-- Fix create_custom_role function
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
  v_role_id uuid;
  v_admin_email text;
  v_admin_name text;
  v_client_ip text;
BEGIN
  -- Check if caller is owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can create custom roles';
  END IF;

  -- Get admin details
  SELECT p.email, p.full_name, inet_client_addr()::text
  INTO v_admin_email, v_admin_name, v_client_ip
  FROM profiles p
  WHERE p.id = auth.uid();

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
  RETURNING id INTO v_role_id;

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
    'create_custom_role',
    NULL,
    NULL,
    jsonb_build_object(
      'role_name', p_role_name,
      'permissions', p_permissions
    ),
    v_client_ip
  );

  -- Log to activity log (FIXED: changed 'details' to 'changes')
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    changes
  ) VALUES (
    auth.uid(),
    'create_custom_role',
    jsonb_build_object(
      'role_name', p_role_name,
      'role_id', v_role_id
    )
  );

  RETURN v_role_id;
END;
$$;

-- Fix change_team_member_role function
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
  v_admin_email text;
  v_admin_name text;
  v_target_email text;
  v_old_role text;
  v_client_ip text;
BEGIN
  -- Check if caller is owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can change roles';
  END IF;

  -- Get old role
  SELECT role INTO v_old_role
  FROM admin_users
  WHERE user_id = p_target_user_id;

  -- Get admin and target details
  SELECT p.email, p.full_name, inet_client_addr()::text
  INTO v_admin_email, v_admin_name, v_client_ip
  FROM profiles p
  WHERE p.id = auth.uid();

  SELECT p.email INTO v_target_email
  FROM profiles p
  WHERE p.id = p_target_user_id;

  -- Update role
  UPDATE admin_users
  SET role = p_new_role, updated_at = now()
  WHERE user_id = p_target_user_id;

  -- Clear custom permissions if not preserving
  IF NOT p_preserve_custom_permissions THEN
    DELETE FROM admin_permissions WHERE user_id = p_target_user_id;
  END IF;

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

  -- Log to activity log (FIXED: changed 'details' to 'changes')
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    changes
  ) VALUES (
    auth.uid(),
    'change_role',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'old_role', v_old_role,
      'new_role', p_new_role
    )
  );
END;
$$;

-- Fix bulk_update_permissions function
CREATE OR REPLACE FUNCTION public.bulk_update_permissions(
  p_user_ids uuid[],
  p_permissions jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_user_id uuid;
BEGIN
  -- Check if caller is owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can bulk update permissions';
  END IF;

  -- Update each user
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    INSERT INTO admin_permissions (user_id, permissions)
    VALUES (v_user_id, p_permissions)
    ON CONFLICT (user_id)
    DO UPDATE SET permissions = p_permissions, updated_at = now();
    
    v_count := v_count + 1;
  END LOOP;

  -- Log activity (FIXED: changed 'details' to 'changes')
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    changes
  ) VALUES (
    auth.uid(),
    'bulk_update_permissions',
    jsonb_build_object(
      'user_count', v_count,
      'user_ids', p_user_ids
    )
  );

  RETURN v_count;
END;
$$;

-- ============================================================================
-- NEW FEATURE: Delete Custom Role
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_custom_role(
  p_role_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
  v_is_custom boolean;
  v_member_count integer;
  v_admin_email text;
  v_admin_name text;
  v_client_ip text;
BEGIN
  -- Check if caller is owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can delete custom roles';
  END IF;

  -- Get role details
  SELECT role_name, is_custom
  INTO v_role_name, v_is_custom
  FROM team_roles
  WHERE id = p_role_id;

  -- Check if role exists
  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  -- Prevent deletion of system roles
  IF NOT v_is_custom THEN
    RAISE EXCEPTION 'Cannot delete system roles (admin, owner, moderator, support)';
  END IF;

  -- Check if any users have this role
  SELECT COUNT(*) INTO v_member_count
  FROM admin_users
  WHERE role = v_role_name;

  IF v_member_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete role: % member(s) currently have this role. Please reassign them first.', v_member_count;
  END IF;

  -- Get admin details for audit log
  SELECT p.email, p.full_name, inet_client_addr()::text
  INTO v_admin_email, v_admin_name, v_client_ip
  FROM profiles p
  WHERE p.id = auth.uid();

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
      'role_id', p_role_id,
      'role_name', v_role_name
    ),
    v_client_ip
  );

  -- Log to activity log
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    changes
  ) VALUES (
    auth.uid(),
    'delete_custom_role',
    jsonb_build_object(
      'role_id', p_role_id,
      'role_name', v_role_name
    )
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.delete_custom_role TO authenticated;