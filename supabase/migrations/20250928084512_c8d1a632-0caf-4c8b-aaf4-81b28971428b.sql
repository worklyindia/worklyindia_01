-- Drop existing function to avoid conflict
DROP FUNCTION IF EXISTS public.admin_update_user_status(uuid, text);

-- Create admin function to update user status
CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_user_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Validate status
  IF p_status NOT IN ('active', 'banned', 'job_banned', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status. Must be active, banned, job_banned, or suspended.';
  END IF;

  -- Update profiles table with new status
  UPDATE public.profiles SET
    account_status = p_status,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- If no profile exists, create one with the status
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, account_status)
    VALUES (p_user_id, p_status)
    ON CONFLICT (user_id) DO UPDATE SET
      account_status = p_status,
      updated_at = now();
  END IF;
END;
$$;