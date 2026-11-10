
-- ============================================================================
-- PHASE 1: CRITICAL SECURITY FIXES
-- ============================================================================

-- 1.1 Fix Function Search Paths - Add SET search_path to all RPC functions
-- This prevents SQL injection and privilege escalation attacks

-- Update get_team_members function
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role text,
  permissions jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  avatar_url text,
  phone text,
  location text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view team members';
  END IF;

  RETURN QUERY
  SELECT 
    au.user_id,
    COALESCE(p.email, au.user_id::text) as email,
    COALESCE(p.full_name, 'Unknown User') as full_name,
    au.role,
    COALESCE(ap.permissions, '{}'::jsonb) as permissions,
    au.last_sign_in_at,
    au.created_at,
    p.avatar_url,
    p.phone,
    p.location
  FROM admin_users au
  LEFT JOIN profiles p ON p.id = au.user_id
  LEFT JOIN admin_permissions ap ON ap.user_id = au.user_id
  ORDER BY au.created_at DESC;
END;
$$;

-- Update assign_role_to_user function
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

  -- Log to activity log
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    details
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

-- Update update_team_member_permissions function
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

  -- Log to activity log
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    details
  ) VALUES (
    auth.uid(),
    'update_permissions',
    jsonb_build_object(
      'target_user_id', p_target_user_id
    )
  );
END;
$$;

-- Update remove_team_member function
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

  -- Log to activity log
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    details
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

-- Update get_audit_logs function
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_action_type text DEFAULT NULL
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
  -- Check if caller is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view audit logs';
  END IF;

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
    al.logged_at
  FROM admin_audit_logs al
  WHERE (p_action_type IS NULL OR al.action_type = p_action_type)
  ORDER BY al.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Update has_permission function
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id uuid,
  p_permission_path text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permissions jsonb;
  v_category text;
  v_action text;
  v_has_permission boolean;
BEGIN
  -- Get user permissions
  SELECT permissions INTO v_permissions
  FROM admin_permissions
  WHERE user_id = p_user_id;

  -- If no permissions found, return false
  IF v_permissions IS NULL THEN
    RETURN false;
  END IF;

  -- Split permission path (e.g., 'users_management.view')
  v_category := split_part(p_permission_path, '.', 1);
  v_action := split_part(p_permission_path, '.', 2);

  -- Check if permission exists and is true
  v_has_permission := COALESCE(
    (v_permissions->v_category->>v_action)::boolean,
    false
  );

  RETURN v_has_permission;
END;
$$;

-- Update verify_super_admin function
CREATE OR REPLACE FUNCTION public.verify_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
    AND role = 'owner'
  );
END;
$$;

-- Update get_user_permissions function
CREATE OR REPLACE FUNCTION public.get_user_permissions(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permissions jsonb;
BEGIN
  -- Get user permissions
  SELECT permissions INTO v_permissions
  FROM admin_permissions
  WHERE user_id = p_user_id;

  -- Return permissions or empty object
  RETURN COALESCE(v_permissions, '{}'::jsonb);
END;
$$;

-- Update create_custom_role function
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

  -- Log to activity log
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    details
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

-- Update search_users_by_email function
CREATE OR REPLACE FUNCTION public.search_users_by_email(
  p_search text
)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can search users';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.avatar_url,
    EXISTS (
      SELECT 1 FROM admin_users au 
      WHERE au.user_id = p.id
    ) as is_admin
  FROM profiles p
  WHERE p.email ILIKE '%' || p_search || '%'
  ORDER BY p.email
  LIMIT 20;
END;
$$;

-- 1.2 Consolidate RLS Policies on team_roles
-- Drop conflicting policies
DROP POLICY IF EXISTS "Admins can view team roles" ON team_roles;
DROP POLICY IF EXISTS "Admins can manage team roles" ON team_roles;
DROP POLICY IF EXISTS "Only owner can modify team roles" ON team_roles;

-- Create single comprehensive policy for SELECT
CREATE POLICY "team_roles_select_policy"
ON team_roles
FOR SELECT
TO authenticated
USING (
  -- Authenticated users can view team roles
  auth.uid() IS NOT NULL
);

-- Create single comprehensive policy for INSERT/UPDATE/DELETE
CREATE POLICY "team_roles_modify_policy"
ON team_roles
FOR ALL
TO authenticated
USING (
  -- Only owners can modify team roles
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role = 'owner'
  )
);

-- ============================================================================
-- PHASE 2: NEW FEATURES - Role Change Function
-- ============================================================================

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

  -- Log to activity log
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    details
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

-- ============================================================================
-- PHASE 3: BULK OPERATIONS FUNCTIONS
-- ============================================================================

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

  -- Log activity
  INSERT INTO admin_activity_log (
    admin_user_id,
    action_type,
    details
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
-- PHASE 4: EXPORT AUDIT LOGS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.export_audit_logs(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_action_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  admin_email text,
  admin_name text,
  action_type text,
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
  -- Check if caller is owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only owners can export audit logs';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.admin_email,
    al.admin_name,
    al.action_type,
    al.target_email,
    al.changes,
    al.ip_address,
    al.logged_at
  FROM admin_audit_logs al
  WHERE 
    (p_start_date IS NULL OR al.logged_at >= p_start_date)
    AND (p_end_date IS NULL OR al.logged_at <= p_end_date)
    AND (p_action_type IS NULL OR al.action_type = p_action_type)
  ORDER BY al.logged_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.change_team_member_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_audit_logs TO authenticated;
