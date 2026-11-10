-- Fix assign_role_to_user - remove non-existent column inserts
CREATE OR REPLACE FUNCTION public.assign_role_to_user(p_target_user_id uuid, p_role text, p_permissions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user is admin (owner or admin role)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Cannot change owner role
  IF EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = p_target_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Cannot modify owner role.';
  END IF;

  -- Insert or update admin_users
  INSERT INTO public.admin_users (user_id, role)
  VALUES (p_target_user_id, p_role::TEXT)
  ON CONFLICT (user_id) 
  DO UPDATE SET role = p_role::TEXT, updated_at = now();

  -- Insert or update permissions
  INSERT INTO public.admin_permissions (user_id, permissions)
  VALUES (p_target_user_id, p_permissions)
  ON CONFLICT (user_id)
  DO UPDATE SET permissions = p_permissions, updated_at = now();

  -- Log action (only with columns that exist)
  INSERT INTO public.admin_activity_log (
    admin_user_id, action_type, target_user_id, changes
  ) VALUES (
    auth.uid(),
    'assign_role',
    p_target_user_id,
    jsonb_build_object('role', p_role, 'permissions', p_permissions)
  );
END;
$$;

-- Fix update_team_member_permissions
CREATE OR REPLACE FUNCTION public.update_team_member_permissions(p_target_user_id uuid, p_permissions jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user is admin (owner or admin role)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Cannot modify owner
  IF EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = p_target_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Cannot modify owner permissions.';
  END IF;

  -- Update permissions
  UPDATE public.admin_permissions
  SET permissions = p_permissions, updated_at = now()
  WHERE user_id = p_target_user_id;

  -- Log action (only with columns that exist)
  INSERT INTO public.admin_activity_log (
    admin_user_id, action_type, target_user_id, changes
  ) VALUES (
    auth.uid(),
    'update_permissions',
    p_target_user_id,
    jsonb_build_object('permissions', p_permissions)
  );
END;
$$;

-- Fix remove_team_member
CREATE OR REPLACE FUNCTION public.remove_team_member(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_role TEXT;
BEGIN
  -- Check if user is admin (owner or admin role)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get target role
  SELECT role INTO v_target_role
  FROM public.admin_users
  WHERE user_id = p_target_user_id;

  -- Cannot remove owner
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove owner from team.';
  END IF;

  -- Remove from admin_users and admin_permissions
  DELETE FROM public.admin_permissions WHERE user_id = p_target_user_id;
  DELETE FROM public.admin_users WHERE user_id = p_target_user_id;

  -- Log action (only with columns that exist)
  INSERT INTO public.admin_activity_log (
    admin_user_id, action_type, target_user_id, changes
  ) VALUES (
    auth.uid(),
    'remove_team_member',
    p_target_user_id,
    jsonb_build_object('removed_role', v_target_role)
  );
END;
$$;

-- Fix create_custom_role
CREATE OR REPLACE FUNCTION public.create_custom_role(p_role_name text, p_role_description text, p_permissions jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- Check if user is admin (owner or admin role)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Insert new custom role
  INSERT INTO team_roles (role_name, role_description, base_permissions, is_custom, created_by)
  VALUES (p_role_name, p_role_description, p_permissions, TRUE, auth.uid())
  RETURNING id INTO v_role_id;

  -- Log action (only with columns that exist)
  INSERT INTO admin_activity_log (admin_user_id, action_type, changes)
  VALUES (
    auth.uid(),
    'create_custom_role',
    jsonb_build_object('role_name', p_role_name, 'role_id', v_role_id)
  );

  RETURN v_role_id;
END;
$$;