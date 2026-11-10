-- Create the grant_admin_access function
CREATE OR REPLACE FUNCTION public.grant_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Insert or update the user as admin/owner
  INSERT INTO public.admin_users (user_id, role)
  VALUES (auth.uid(), 'owner')
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = 'owner',
    updated_at = now();
    
  -- Log the action
  RAISE NOTICE 'Admin access granted to user %', auth.uid();
END;
$$;