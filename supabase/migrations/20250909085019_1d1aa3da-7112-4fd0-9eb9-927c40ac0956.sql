-- Step 1: Create a security definer function to check admin roles without RLS recursion
CREATE OR REPLACE FUNCTION public.check_admin_role(target_user_id uuid, required_role text DEFAULT 'admin')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if user has the required role or is an owner
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = target_user_id 
    AND (role = required_role OR role = 'owner')
  );
END;
$$;

-- Step 2: Drop existing problematic RLS policies
DROP POLICY IF EXISTS "Admin users can manage admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Users can check their own admin status" ON public.admin_users;

-- Step 3: Create new RLS policies using the security definer function
CREATE POLICY "Owners can manage admin_users"
ON public.admin_users
FOR ALL
USING (public.check_admin_role(auth.uid(), 'owner'));

CREATE POLICY "Users can check their own admin status"
ON public.admin_users
FOR SELECT
USING (user_id = auth.uid());

-- Step 4: Insert your user as owner (if not already exists)
INSERT INTO public.admin_users (user_id, role, created_by)
VALUES ('1769cddb-7244-4b4b-a86f-e0ca3bc028db', 'owner', '1769cddb-7244-4b4b-a86f-e0ca3bc028db')
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'owner',
  updated_at = now();