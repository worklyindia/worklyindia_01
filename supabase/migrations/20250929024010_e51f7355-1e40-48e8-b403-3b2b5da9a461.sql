-- Create a simple function to grant admin access (for development)
CREATE OR REPLACE FUNCTION public.grant_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Grant admin role to current authenticated user
  INSERT INTO public.admin_users (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = 'admin',
    updated_at = now();
END;
$$;