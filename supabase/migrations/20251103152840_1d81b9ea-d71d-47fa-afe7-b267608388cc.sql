-- Phase 1.1: Fix Security Definer Functions Search Path
-- Drop existing function to change return type
DROP FUNCTION IF EXISTS public.get_team_members();

-- Create get_team_members function with enhanced profile data
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  permissions JSONB,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  avatar_url TEXT,
  phone TEXT,
  location TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only super admin can view team members';
  END IF;

  -- Return team members with profile info
  RETURN QUERY
  SELECT 
    au.user_id,
    au.email,
    au.full_name,
    au.role,
    COALESCE(ap.permissions, '{}'::jsonb) as permissions,
    au.last_sign_in_at,
    au.created_at,
    p.avatar_url,
    p.phone,
    p.location
  FROM admin_users au
  LEFT JOIN admin_permissions ap ON au.user_id = ap.user_id
  LEFT JOIN profiles p ON au.user_id = p.user_id
  ORDER BY au.created_at DESC;
END;
$$;

-- Update get_audit_logs function with search_path
DROP FUNCTION IF EXISTS public.get_audit_logs(INT, INT, TEXT);

CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0,
  p_action_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  admin_user_id UUID,
  admin_email TEXT,
  admin_name TEXT,
  action_type TEXT,
  target_user_id UUID,
  target_email TEXT,
  changes JSONB,
  ip_address TEXT,
  logged_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only super admin can view audit logs';
  END IF;

  RETURN QUERY
  SELECT 
    aal.id,
    aal.admin_user_id,
    aal.admin_email,
    aal.admin_name,
    aal.action_type,
    aal.target_user_id,
    aal.target_email,
    aal.changes,
    aal.ip_address,
    aal.logged_at
  FROM admin_activity_log aal
  WHERE p_action_type IS NULL OR aal.action_type = p_action_type
  ORDER BY aal.logged_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Update create_custom_role function with search_path
DROP FUNCTION IF EXISTS public.create_custom_role(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.create_custom_role(
  p_role_name TEXT,
  p_role_description TEXT,
  p_permissions JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only super admin can create custom roles';
  END IF;

  -- Insert new custom role
  INSERT INTO team_roles (role_name, role_description, base_permissions, is_custom, created_by)
  VALUES (p_role_name, p_role_description, p_permissions, TRUE, auth.uid())
  RETURNING id INTO v_role_id;

  -- Log the action
  INSERT INTO admin_activity_log (admin_user_id, admin_email, admin_name, action_type, changes)
  SELECT 
    auth.uid(),
    au.email,
    au.full_name,
    'create_custom_role',
    jsonb_build_object('role_name', p_role_name, 'role_id', v_role_id)
  FROM admin_users au
  WHERE au.user_id = auth.uid();

  RETURN v_role_id;
END;
$$;

-- Update verify_super_admin function with search_path
DROP FUNCTION IF EXISTS public.verify_super_admin();

CREATE OR REPLACE FUNCTION public.verify_super_admin()
RETURNS BOOLEAN
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

-- Update has_permission function with search_path
DROP FUNCTION IF EXISTS public.has_permission(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id UUID,
  p_permission_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permissions JSONB;
  v_parts TEXT[];
  v_category TEXT;
  v_action TEXT;
BEGIN
  -- Get user permissions
  SELECT permissions INTO v_permissions
  FROM admin_permissions
  WHERE user_id = p_user_id;

  IF v_permissions IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Parse permission path (e.g., "users_management.edit")
  v_parts := string_to_array(p_permission_path, '.');
  
  IF array_length(v_parts, 1) != 2 THEN
    RETURN FALSE;
  END IF;

  v_category := v_parts[1];
  v_action := v_parts[2];

  -- Check if permission exists and is true
  RETURN COALESCE((v_permissions -> v_category ->> v_action)::boolean, FALSE);
END;
$$;

-- Phase 1.2: Create search_users_by_email function
CREATE OR REPLACE FUNCTION public.search_users_by_email(p_search TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only super admin can search users';
  END IF;

  -- Search users by email (exclude existing admins)
  RETURN QUERY
  SELECT 
    p.user_id,
    p.email,
    p.full_name,
    p.avatar_url,
    EXISTS(SELECT 1 FROM admin_users au WHERE au.user_id = p.user_id) as is_admin
  FROM profiles p
  WHERE 
    p.email ILIKE '%' || p_search || '%'
    OR p.full_name ILIKE '%' || p_search || '%'
  ORDER BY 
    CASE WHEN p.email ILIKE p_search || '%' THEN 1 ELSE 2 END,
    p.email
  LIMIT 10;
END;
$$;