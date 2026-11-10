-- Fix RLS policy on admin_users to allow SECURITY DEFINER functions to check admin status
-- This ensures get_all_website_users can verify admin role without RLS blocking

-- Add policy to allow security definer functions to check admin status
CREATE POLICY "Allow security definer functions to check admin status"
ON public.admin_users
FOR SELECT
TO authenticated
USING (
  -- Allow users to check their own admin status
  user_id = auth.uid()
  OR
  -- Allow security definer functions to query admin_users
  current_setting('request.jwt.claim.sub', true)::uuid = user_id
);

-- Add comment for documentation
COMMENT ON POLICY "Allow security definer functions to check admin status" ON public.admin_users 
IS 'Allows SECURITY DEFINER functions to query admin_users table to verify admin roles without RLS blocking the query';