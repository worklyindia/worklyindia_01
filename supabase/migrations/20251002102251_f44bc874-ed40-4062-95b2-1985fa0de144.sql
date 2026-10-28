-- Create a function to check if an email exists in auth.users
-- This is needed for password reset validation for job seekers

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if email exists in auth.users
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE email = p_email
  );
END;
$$;