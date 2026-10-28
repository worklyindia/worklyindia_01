-- Fix RLS policies for team_roles table to allow authenticated users to view roles

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view team roles" ON team_roles;
DROP POLICY IF EXISTS "Authenticated users can view team roles" ON team_roles;

-- Create policy to allow authenticated users to view all team roles
CREATE POLICY "Authenticated users can view team roles"
ON team_roles
FOR SELECT
TO authenticated
USING (true);

-- Keep admin management policy
DROP POLICY IF EXISTS "Admins can manage team roles" ON team_roles;
CREATE POLICY "Admins can manage team roles"
ON team_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role IN ('admin', 'owner')
  )
);