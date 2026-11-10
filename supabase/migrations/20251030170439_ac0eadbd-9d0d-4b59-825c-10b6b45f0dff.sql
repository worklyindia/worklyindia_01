-- Fix the get_team_members function to resolve ambiguous user_id reference
CREATE OR REPLACE FUNCTION get_team_members()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role text,
  permissions jsonb,
  last_sign_in_at timestamp with time zone,
  created_at timestamp with time zone
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    au.user_id,
    COALESCE(u.email, '') as email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email, 'Unknown') as full_name,
    au.role,
    COALESCE(ap.permissions, '{}'::jsonb) as permissions,
    u.last_sign_in_at,
    au.created_at
  FROM admin_users au
  LEFT JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN admin_permissions ap ON ap.user_id = au.user_id
  ORDER BY au.created_at DESC;
END;
$$;

-- Ensure we have default team roles
INSERT INTO team_roles (role_name, role_description, base_permissions, is_custom)
VALUES 
  ('admin', 'Full administrative access to all features', 
   '{"users_management": {"view": true, "edit": true, "delete": true, "ban": true}, 
     "employers_management": {"view": true, "edit": true, "delete": true, "verify": true}, 
     "analytics": {"view": true, "export": true}, 
     "financial": {"view": true, "edit": true, "approve_withdrawals": true}, 
     "content": {"view": true, "edit": true, "publish": true}, 
     "settings": {"view": true, "edit": true}, 
     "team_management": {"view": true, "invite": true, "edit_roles": true, "remove_members": true}, 
     "packages": {"view": true, "edit": true, "create": true}, 
     "support": {"view": true, "respond": true, "close_tickets": true}}'::jsonb, 
   false),
  ('moderator', 'Can manage users and content but with limited access', 
   '{"users_management": {"view": true, "edit": true, "delete": false, "ban": true}, 
     "employers_management": {"view": true, "edit": true, "delete": false, "verify": false}, 
     "analytics": {"view": true, "export": false}, 
     "financial": {"view": true, "edit": false, "approve_withdrawals": false}, 
     "content": {"view": true, "edit": true, "publish": false}, 
     "settings": {"view": true, "edit": false}, 
     "team_management": {"view": true, "invite": false, "edit_roles": false, "remove_members": false}, 
     "packages": {"view": true, "edit": false, "create": false}, 
     "support": {"view": true, "respond": true, "close_tickets": true}}'::jsonb, 
   false),
  ('viewer', 'Read-only access to most features', 
   '{"users_management": {"view": true, "edit": false, "delete": false, "ban": false}, 
     "employers_management": {"view": true, "edit": false, "delete": false, "verify": false}, 
     "analytics": {"view": true, "export": false}, 
     "financial": {"view": true, "edit": false, "approve_withdrawals": false}, 
     "content": {"view": true, "edit": false, "publish": false}, 
     "settings": {"view": true, "edit": false}, 
     "team_management": {"view": true, "invite": false, "edit_roles": false, "remove_members": false}, 
     "packages": {"view": true, "edit": false, "create": false}, 
     "support": {"view": true, "respond": false, "close_tickets": false}}'::jsonb, 
   false)
ON CONFLICT (role_name) 
DO UPDATE SET 
  role_description = EXCLUDED.role_description,
  base_permissions = EXCLUDED.base_permissions,
  updated_at = now();