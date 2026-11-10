-- Drop existing functions first
DROP FUNCTION IF EXISTS public.admin_update_user_status(uuid, text);
DROP FUNCTION IF EXISTS public.admin_update_jobseeker_profile(text, text, text, text, text, text, text, text, text[], text[], integer, text, text, text, text, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_update_company_profile(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);

-- Create admin_update_user_status function with proper return type
CREATE OR REPLACE FUNCTION public.admin_update_user_status(p_user_id uuid, p_action text)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update user status based on action
  IF p_action = 'activate' THEN
    -- For now, just log the action (could extend to update a status field if needed)
    RAISE NOTICE 'User % activated by admin %', p_user_id, auth.uid();
  ELSIF p_action = 'deactivate' THEN
    -- For now, just log the action (could extend to update a status field if needed)
    RAISE NOTICE 'User % deactivated by admin %', p_user_id, auth.uid();
  ELSE
    RAISE EXCEPTION 'Invalid action. Use activate or deactivate.';
  END IF;
END;
$$;