-- Drop the duplicate is_admin function with parameter
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- Ensure we have the correct is_admin function without parameters
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  );
END;
$$;