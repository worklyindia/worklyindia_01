-- ============================================================================
-- Fix errors from screenshots:
-- 1) relation "public.custom_roles" does not exist → create table + policies
-- 2) column "user_id" of relation "admin_audit_logs" does not exist →
--    update functions to use correct audit log columns
-- ============================================================================

-- 1) Create custom_roles table (if missing)
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text UNIQUE NOT NULL,
  role_description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and restrict to admin/owner
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage custom roles" ON public.custom_roles;
CREATE POLICY "Admins can manage custom roles"
ON public.custom_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.role IN ('admin','owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.role IN ('admin','owner')
  )
);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_custom_roles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_custom_roles_updated_at ON public.custom_roles;
CREATE TRIGGER trg_update_custom_roles_updated_at
BEFORE UPDATE ON public.custom_roles
FOR EACH ROW EXECUTE FUNCTION public.update_custom_roles_updated_at();

-- 2) Recreate functions to use admin_audit_logs correct columns
--    (performed_by, admin_user_id, admin_email, admin_name, action, action_type,
--     target_user_id, target_email, details, changes, ip_address)

-- Assign Role
CREATE OR REPLACE FUNCTION public.assign_role_to_user(
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
  v_admin_name TEXT;
  v_target_email TEXT;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.admin_users
  WHERE user_id = auth.uid();
  IF v_caller_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'Access denied. Only admins and owners can assign roles.';
  END IF;

  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT COALESCE(p.full_name, v_admin_email) INTO v_admin_name FROM public.profiles p WHERE p.user_id = auth.uid();
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;

  INSERT INTO public.admin_users (user_id, role, created_by, created_at, updated_at)
  VALUES (p_target_user_id, p_role, auth.uid(), now(), now())
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();

  IF p_permissions IS NOT NULL AND p_permissions != '{}'::jsonb THEN
    INSERT INTO public.admin_permissions (user_id, permissions, updated_at)
    VALUES (p_target_user_id, p_permissions, now())
    ON CONFLICT (user_id) DO UPDATE SET permissions = EXCLUDED.permissions, updated_at = now();
  END IF;

  INSERT INTO public.admin_audit_logs (
    performed_by,
    admin_user_id,
    admin_email,
    admin_name,
    action,
    action_type,
    target_user_id,
    target_email,
    details,
    changes,
    ip_address
  ) VALUES (
    auth.uid(),
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'assign_role',
    'assign_role',
    p_target_user_id,
    v_target_email,
    jsonb_build_object('message','Assigned role to user'),
    jsonb_build_object('role', p_role, 'permissions', p_permissions),
    inet_client_addr()::text
  );

  RETURN jsonb_build_object('success', true, 'message', 'Role assigned successfully', 'user_id', p_target_user_id, 'role', p_role);
END;
$$;

-- Change Team Member Role
CREATE OR REPLACE FUNCTION public.change_team_member_role(
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
  v_admin_email TEXT;
  v_admin_name TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.admin_users WHERE user_id = auth.uid();
  IF v_caller_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'Access denied. Only admins and owners can change roles.';
  END IF;

  SELECT role INTO v_old_role FROM public.admin_users WHERE user_id = p_target_user_id;
  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT COALESCE(p.full_name, v_admin_email) INTO v_admin_name FROM public.profiles p WHERE p.user_id = auth.uid();

  UPDATE public.admin_users SET role = p_new_role, updated_at = now() WHERE user_id = p_target_user_id;

  IF NOT p_preserve_custom_permissions THEN
    DELETE FROM public.admin_permissions WHERE user_id = p_target_user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (
    performed_by,
    admin_user_id,
    admin_email,
    admin_name,
    action,
    action_type,
    target_user_id,
    target_email,
    details,
    changes,
    ip_address
  ) VALUES (
    auth.uid(),
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'change_role',
    'change_role',
    p_target_user_id,
    v_target_email,
    jsonb_build_object('message','Changed team member role'),
    jsonb_build_object('old_role', v_old_role, 'new_role', p_new_role, 'preserve_permissions', p_preserve_custom_permissions),
    inet_client_addr()::text
  );

  RETURN jsonb_build_object('success', true, 'message', 'Role changed successfully', 'user_id', p_target_user_id, 'old_role', v_old_role, 'new_role', p_new_role);
END;
$$;

-- Create Custom Role
CREATE OR REPLACE FUNCTION public.create_custom_role(
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
  v_admin_email TEXT;
  v_admin_name TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.admin_users WHERE user_id = auth.uid();
  IF v_caller_role NOT IN ('admin','owner') THEN
    RAISE EXCEPTION 'Access denied. Only admins and owners can create custom roles.';
  END IF;

  INSERT INTO public.custom_roles (role_name, role_description, permissions, created_by)
  VALUES (p_role_name, p_role_description, p_permissions, auth.uid())
  RETURNING id INTO v_role_id;

  SELECT email INTO v_admin_email FROM auth.users WHERE id = auth.uid();
  SELECT COALESCE(p.full_name, v_admin_email) INTO v_admin_name FROM public.profiles p WHERE p.user_id = auth.uid();

  INSERT INTO public.admin_audit_logs (
    performed_by,
    admin_user_id,
    admin_email,
    admin_name,
    action,
    action_type,
    target_id,
    details,
    changes,
    ip_address
  ) VALUES (
    auth.uid(),
    auth.uid(),
    v_admin_email,
    v_admin_name,
    'create_custom_role',
    'create_custom_role',
    v_role_id,
    jsonb_build_object('message','Created custom role'),
    jsonb_build_object('role_id', v_role_id, 'role_name', p_role_name, 'permissions', p_permissions),
    inet_client_addr()::text
  );

  RETURN jsonb_build_object('success', true, 'message', 'Custom role created successfully', 'role_id', v_role_id, 'role_name', p_role_name);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.assign_role_to_user(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_team_member_role(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_role(TEXT, TEXT, JSONB) TO authenticated;
