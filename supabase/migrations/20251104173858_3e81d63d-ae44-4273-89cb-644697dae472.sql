-- Fix assign_role_to_user function: retrieve email from auth.users instead of profiles
-- This fixes the "column 'email' does not exist" error

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

  -- FIX: Get emails from auth.users instead of profiles
  SELECT email INTO v_admin_email FROM auth.users WHERE id = v_admin_user_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;

  -- Insert into admin_users
  INSERT INTO admin_users (user_id, role)
  VALUES (p_target_user_id, p_role);

  -- Insert permissions
  INSERT INTO admin_permissions (user_id, permissions)
  VALUES (p_target_user_id, p_permissions);

  -- Log the action to admin_audit_log
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

GRANT EXECUTE ON FUNCTION public.assign_role_to_user(uuid, text, jsonb, text) TO authenticated;