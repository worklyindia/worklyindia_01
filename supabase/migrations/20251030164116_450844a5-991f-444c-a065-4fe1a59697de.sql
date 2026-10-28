-- ============================================================================
-- Team & Role Management System - Database Schema (FIXED)
-- ============================================================================

-- 1. Create team_roles table for custom role definitions
CREATE TABLE IF NOT EXISTS public.team_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  role_description TEXT,
  base_permissions JSONB DEFAULT '{}'::jsonb,
  is_custom BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create admin_activity_log table for audit trail
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  changes JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  logged_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS on new tables
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for team_roles
CREATE POLICY "Admins can view team roles"
  ON public.team_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Only owner can modify team roles"
  ON public.team_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      JOIN auth.users u ON u.id = au.user_id
      WHERE au.user_id = auth.uid() 
        AND au.role = 'owner'
        AND u.email = 'gohilvishal7600@gmail.com'
    )
  );

-- 5. RLS Policies for admin_activity_log
CREATE POLICY "Admins can view activity logs"
  ON public.admin_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Activity logs are write-only via RPC"
  ON public.admin_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

-- 6. Enhance admin_permissions table (if needed)
ALTER TABLE public.admin_permissions 
  ALTER COLUMN permissions SET DEFAULT '{
    "users_management": {"view": false, "edit": false, "delete": false, "ban": false},
    "employers_management": {"view": false, "edit": false, "verify": false, "delete": false},
    "analytics": {"view": false, "export": false},
    "financial": {"view": false, "edit": false, "approve_withdrawals": false},
    "content": {"view": false, "edit": false, "publish": false},
    "settings": {"view": false, "edit": false},
    "team_management": {"view": false, "invite": false, "edit_roles": false, "remove_members": false},
    "packages": {"view": false, "edit": false, "create": false},
    "support": {"view": false, "respond": false, "close_tickets": false}
  }'::jsonb;

-- ============================================================================
-- RPC Functions for Team Management
-- ============================================================================

-- 7. Verify Super Admin function
CREATE OR REPLACE FUNCTION public.verify_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users au
    JOIN auth.users u ON u.id = au.user_id
    WHERE au.user_id = auth.uid() 
      AND au.role = 'owner'
      AND u.email = 'gohilvishal7600@gmail.com'
  );
END;
$$;

-- 8. Get team members function
CREATE OR REPLACE FUNCTION public.get_team_members()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  permissions JSONB,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    au.user_id,
    u.email::TEXT,
    COALESCE(p.full_name, '')::TEXT,
    au.role::TEXT,
    COALESCE(ap.permissions, '{}'::jsonb) as permissions,
    u.last_sign_in_at,
    au.created_at
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN public.profiles p ON p.user_id = au.user_id
  LEFT JOIN public.admin_permissions ap ON ap.user_id = au.user_id
  ORDER BY 
    CASE au.role 
      WHEN 'owner' THEN 1 
      WHEN 'admin' THEN 2 
      ELSE 3 
    END,
    au.created_at DESC;
END;
$$;

-- 9. Create custom role function
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
  -- Only super admin can create roles
  IF NOT public.verify_super_admin() THEN
    RAISE EXCEPTION 'Only Super Admin can create custom roles.';
  END IF;

  INSERT INTO public.team_roles (
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

  -- Log action
  INSERT INTO public.admin_activity_log (
    admin_user_id, action_type, changes
  ) VALUES (
    auth.uid(),
    'create_custom_role',
    jsonb_build_object('role_name', p_role_name, 'permissions', p_permissions)
  );

  RETURN v_role_id;
END;
$$;

-- 10. Assign role to user function
CREATE OR REPLACE FUNCTION public.assign_role_to_user(
  p_target_user_id UUID,
  p_role TEXT,
  p_permissions JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admin can assign roles
  IF NOT public.verify_super_admin() THEN
    RAISE EXCEPTION 'Only Super Admin can assign roles.';
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

  -- Log action
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

-- 11. Update team member permissions function
CREATE OR REPLACE FUNCTION public.update_team_member_permissions(
  p_target_user_id UUID,
  p_permissions JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admin can update permissions
  IF NOT public.verify_super_admin() THEN
    RAISE EXCEPTION 'Only Super Admin can update permissions.';
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

  -- Log action
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

-- 12. Remove team member function
CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role TEXT;
BEGIN
  -- Only super admin can remove members
  IF NOT public.verify_super_admin() THEN
    RAISE EXCEPTION 'Only Super Admin can remove team members.';
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

  -- Log action
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

-- 13. Check permission function
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
  v_result BOOLEAN;
BEGIN
  -- Owner has all permissions
  IF EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = p_user_id AND role = 'owner'
  ) THEN
    RETURN true;
  END IF;

  -- Get user permissions
  SELECT permissions INTO v_permissions
  FROM public.admin_permissions
  WHERE user_id = p_user_id;

  IF v_permissions IS NULL THEN
    RETURN false;
  END IF;

  -- Parse permission path (e.g., "users_management.edit")
  v_parts := string_to_array(p_permission_path, '.');
  
  IF array_length(v_parts, 1) = 2 THEN
    v_result := COALESCE((v_permissions->v_parts[1]->>v_parts[2])::boolean, false);
  ELSE
    v_result := false;
  END IF;

  RETURN v_result;
END;
$$;

-- 14. Get user permissions function
CREATE OR REPLACE FUNCTION public.get_user_permissions(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permissions JSONB;
  v_role TEXT;
BEGIN
  -- Get role
  SELECT role INTO v_role
  FROM public.admin_users
  WHERE user_id = p_user_id;

  -- Owner has all permissions
  IF v_role = 'owner' THEN
    RETURN '{
      "users_management": {"view": true, "edit": true, "delete": true, "ban": true},
      "employers_management": {"view": true, "edit": true, "verify": true, "delete": true},
      "analytics": {"view": true, "export": true},
      "financial": {"view": true, "edit": true, "approve_withdrawals": true},
      "content": {"view": true, "edit": true, "publish": true},
      "settings": {"view": true, "edit": true},
      "team_management": {"view": true, "invite": true, "edit_roles": true, "remove_members": true},
      "packages": {"view": true, "edit": true, "create": true},
      "support": {"view": true, "respond": true, "close_tickets": true}
    }'::jsonb;
  END IF;

  -- Get custom permissions
  SELECT permissions INTO v_permissions
  FROM public.admin_permissions
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_permissions, '{}'::jsonb);
END;
$$;

-- 15. Get audit logs function
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0,
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
  -- Only admins can view logs
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    aal.id,
    aal.admin_user_id,
    au.email::TEXT as admin_email,
    COALESCE(p.full_name, au.email)::TEXT as admin_name,
    aal.action_type::TEXT,
    aal.target_user_id,
    tu.email::TEXT as target_email,
    aal.changes,
    aal.ip_address::TEXT,
    aal.logged_at
  FROM public.admin_activity_log aal
  JOIN auth.users au ON au.id = aal.admin_user_id
  LEFT JOIN public.profiles p ON p.user_id = aal.admin_user_id
  LEFT JOIN auth.users tu ON tu.id = aal.target_user_id
  WHERE (p_action_type IS NULL OR aal.action_type = p_action_type)
  ORDER BY aal.logged_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 16. Create trigger for updating team_roles updated_at
CREATE OR REPLACE FUNCTION public.update_team_roles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_team_roles_updated_at
  BEFORE UPDATE ON public.team_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_roles_updated_at();

-- 17. Insert default predefined roles
INSERT INTO public.team_roles (role_name, role_description, base_permissions, is_custom, created_by)
VALUES 
  ('admin', 'Full administrative access except team management', '{
    "users_management": {"view": true, "edit": true, "delete": false, "ban": false},
    "employers_management": {"view": true, "edit": true, "verify": true, "delete": false},
    "analytics": {"view": true, "export": true},
    "financial": {"view": true, "edit": false, "approve_withdrawals": false},
    "content": {"view": true, "edit": true, "publish": true},
    "settings": {"view": true, "edit": false},
    "team_management": {"view": false, "invite": false, "edit_roles": false, "remove_members": false},
    "packages": {"view": true, "edit": false, "create": false},
    "support": {"view": true, "respond": true, "close_tickets": true}
  }'::jsonb, false, NULL),
  
  ('moderator', 'Content moderation and user management', '{
    "users_management": {"view": true, "edit": true, "delete": false, "ban": true},
    "employers_management": {"view": true, "edit": false, "verify": false, "delete": false},
    "analytics": {"view": true, "export": false},
    "financial": {"view": false, "edit": false, "approve_withdrawals": false},
    "content": {"view": true, "edit": true, "publish": false},
    "settings": {"view": false, "edit": false},
    "team_management": {"view": false, "invite": false, "edit_roles": false, "remove_members": false},
    "packages": {"view": true, "edit": false, "create": false},
    "support": {"view": true, "respond": true, "close_tickets": true}
  }'::jsonb, false, NULL),
  
  ('support', 'Customer support and ticket management', '{
    "users_management": {"view": true, "edit": false, "delete": false, "ban": false},
    "employers_management": {"view": true, "edit": false, "verify": false, "delete": false},
    "analytics": {"view": false, "export": false},
    "financial": {"view": false, "edit": false, "approve_withdrawals": false},
    "content": {"view": true, "edit": false, "publish": false},
    "settings": {"view": false, "edit": false},
    "team_management": {"view": false, "invite": false, "edit_roles": false, "remove_members": false},
    "packages": {"view": false, "edit": false, "create": false},
    "support": {"view": true, "respond": true, "close_tickets": true}
  }'::jsonb, false, NULL),
  
  ('finance_manager', 'Financial operations and approvals', '{
    "users_management": {"view": true, "edit": false, "delete": false, "ban": false},
    "employers_management": {"view": true, "edit": false, "verify": false, "delete": false},
    "analytics": {"view": true, "export": true},
    "financial": {"view": true, "edit": true, "approve_withdrawals": true},
    "content": {"view": false, "edit": false, "publish": false},
    "settings": {"view": false, "edit": false},
    "team_management": {"view": false, "invite": false, "edit_roles": false, "remove_members": false},
    "packages": {"view": true, "edit": true, "create": true},
    "support": {"view": false, "respond": false, "close_tickets": false}
  }'::jsonb, false, NULL),
  
  ('content_manager', 'Content creation and publishing', '{
    "users_management": {"view": true, "edit": false, "delete": false, "ban": false},
    "employers_management": {"view": true, "edit": false, "verify": false, "delete": false},
    "analytics": {"view": true, "export": false},
    "financial": {"view": false, "edit": false, "approve_withdrawals": false},
    "content": {"view": true, "edit": true, "publish": true},
    "settings": {"view": false, "edit": false},
    "team_management": {"view": false, "invite": false, "edit_roles": false, "remove_members": false},
    "packages": {"view": false, "edit": false, "create": false},
    "support": {"view": true, "respond": true, "close_tickets": false}
  }'::jsonb, false, NULL)
ON CONFLICT (role_name) DO NOTHING;