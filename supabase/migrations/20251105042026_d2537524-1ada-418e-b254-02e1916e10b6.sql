-- ============================================================================
-- FORCE DROP ALL FUNCTION VERSIONS - Complete Cleanup
-- ============================================================================
-- This will remove EVERY version of the conflicting functions by explicitly
-- specifying all parameter combinations that exist in the database.

-- ============================================================================
-- Drop ALL versions of assign_role_to_user
-- ============================================================================
DROP FUNCTION IF EXISTS public.assign_role_to_user(uuid, text, jsonb, text);
DROP FUNCTION IF EXISTS public.assign_role_to_user(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.assign_role_to_user(uuid, text, text);
DROP FUNCTION IF EXISTS public.assign_role_to_user(uuid, text);

-- ============================================================================
-- Drop ALL versions of change_team_member_role
-- ============================================================================
DROP FUNCTION IF EXISTS public.change_team_member_role(uuid, text, boolean, text);
DROP FUNCTION IF EXISTS public.change_team_member_role(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.change_team_member_role(uuid, text, text);
DROP FUNCTION IF EXISTS public.change_team_member_role(uuid, text);

-- ============================================================================
-- Drop ALL versions of create_custom_role
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_custom_role(text, text, jsonb, text);
DROP FUNCTION IF EXISTS public.create_custom_role(text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_custom_role(text, jsonb, text);
DROP FUNCTION IF EXISTS public.create_custom_role(text, jsonb);
DROP FUNCTION IF EXISTS public.create_custom_role(text, text);

-- ============================================================================
-- Recreate ONLY ONE VERSION of each function
-- ============================================================================

-- Function 1: Assign Role (for inviting team members)
CREATE FUNCTION public.assign_role_to_user(
  p_target_user_id UUID,
  p_role TEXT,
  p_permissions JSONB DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_admin_email TEXT;
  v_target_email TEXT;
BEGIN
  -- Check caller permissions
  SELECT role INTO v_caller_role
  FROM public.admin_users
  WHERE user_id = auth.uid();
  
  IF v_caller_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Access denied. Only admins and owners can assign roles.';
  END IF;
  
  -- Get emails for audit log
  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  
  -- Assign role in admin_users
  INSERT INTO public.admin_users (user_id, role, created_by, created_at, updated_at)
  VALUES (p_target_user_id, p_role, auth.uid(), now(), now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = p_role,
    updated_at = now();
  
  -- Assign permissions if provided
  IF p_permissions IS NOT NULL AND p_permissions != '{}'::jsonb THEN
    INSERT INTO public.admin_permissions (user_id, permissions, updated_at)
    VALUES (p_target_user_id, p_permissions, now())
    ON CONFLICT (user_id)
    DO UPDATE SET 
      permissions = p_permissions,
      updated_at = now();
  END IF;
  
  -- Create audit log
  INSERT INTO public.admin_audit_logs (
    user_id,
    action,
    details,
    ip_address
  ) VALUES (
    auth.uid(),
    'assign_role',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_email', v_target_email,
      'role', p_role,
      'permissions', p_permissions
    ),
    inet_client_addr()::text
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role assigned successfully',
    'user_id', p_target_user_id,
    'role', p_role
  );
END;
$$;

-- Function 2: Change Team Member Role (for bulk changes)
CREATE FUNCTION public.change_team_member_role(
  p_target_user_id UUID,
  p_new_role TEXT,
  p_preserve_custom_permissions BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_old_role TEXT;
  v_target_email TEXT;
BEGIN
  -- Check caller permissions
  SELECT role INTO v_caller_role
  FROM public.admin_users
  WHERE user_id = auth.uid();
  
  IF v_caller_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Access denied. Only admins and owners can change roles.';
  END IF;
  
  -- Get current role and target email
  SELECT role INTO v_old_role
  FROM public.admin_users
  WHERE user_id = p_target_user_id;
  
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  
  -- Update role
  UPDATE public.admin_users
  SET role = p_new_role, updated_at = now()
  WHERE user_id = p_target_user_id;
  
  -- Clear custom permissions unless preserve flag is set
  IF NOT p_preserve_custom_permissions THEN
    DELETE FROM public.admin_permissions
    WHERE user_id = p_target_user_id;
  END IF;
  
  -- Create audit log
  INSERT INTO public.admin_audit_logs (
    user_id,
    action,
    details,
    ip_address
  ) VALUES (
    auth.uid(),
    'change_role',
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_email', v_target_email,
      'old_role', v_old_role,
      'new_role', p_new_role,
      'preserve_permissions', p_preserve_custom_permissions
    ),
    inet_client_addr()::text
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role changed successfully',
    'user_id', p_target_user_id,
    'old_role', v_old_role,
    'new_role', p_new_role
  );
END;
$$;

-- Function 3: Create Custom Role
CREATE FUNCTION public.create_custom_role(
  p_role_name TEXT,
  p_role_description TEXT,
  p_permissions JSONB
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_role_id UUID;
BEGIN
  -- Check caller permissions
  SELECT role INTO v_caller_role
  FROM public.admin_users
  WHERE user_id = auth.uid();
  
  IF v_caller_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Access denied. Only admins and owners can create custom roles.';
  END IF;
  
  -- Insert custom role
  INSERT INTO public.custom_roles (
    role_name,
    role_description,
    permissions,
    created_by
  ) VALUES (
    p_role_name,
    p_role_description,
    p_permissions,
    auth.uid()
  )
  RETURNING id INTO v_role_id;
  
  -- Create audit log
  INSERT INTO public.admin_audit_logs (
    user_id,
    action,
    details,
    ip_address
  ) VALUES (
    auth.uid(),
    'create_custom_role',
    jsonb_build_object(
      'role_id', v_role_id,
      'role_name', p_role_name,
      'permissions', p_permissions
    ),
    inet_client_addr()::text
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Custom role created successfully',
    'role_id', v_role_id,
    'role_name', p_role_name
  );
END;
$$;

-- ============================================================================
-- Grant Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.assign_role_to_user(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_team_member_role(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_role(TEXT, TEXT, JSONB) TO authenticated;