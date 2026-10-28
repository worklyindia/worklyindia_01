-- Fix: Disable RLS recursion on admin_users table
-- The admin_users table is only accessed through SECURITY DEFINER functions
-- which have their own authorization checks, so complex RLS is unnecessary

-- Drop all existing policies that may cause recursion
DROP POLICY IF EXISTS "Allow security definer functions to check admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Owners can manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Users can check their own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Users can view their own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Admin operations allowed" ON public.admin_users;

-- Temporarily disable RLS
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- Re-enable with a simple, non-recursive policy
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Simple policy: Authenticated users can only view their own admin record
-- This is safe because all admin operations go through SECURITY DEFINER functions
CREATE POLICY "Authenticated users can check their own admin status"
ON public.admin_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Grant necessary permissions
GRANT SELECT ON public.admin_users TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE public.admin_users IS 'Admin users table with simplified RLS. All admin operations are handled through SECURITY DEFINER functions with explicit authorization checks.';

-- Success notification
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed admin_users RLS - removed infinite recursion risk';
  RAISE NOTICE '✅ Users can now check their own admin status';
  RAISE NOTICE '✅ All admin operations use SECURITY DEFINER functions';
END $$;