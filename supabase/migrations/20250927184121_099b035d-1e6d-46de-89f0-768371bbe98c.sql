-- Create a function to safely delete a user and all associated data
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_data jsonb;
  user_email text;
  user_name text;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get user details before deletion
  SELECT 
    COALESCE(p.full_name, 'Unknown User'),
    COALESCE(au.email, 'Unknown Email')
  INTO user_name, user_email
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE au.id = target_user_id;

  -- Delete from auth.users (this will cascade delete related records due to foreign keys)
  DELETE FROM auth.users WHERE id = target_user_id;

  -- Build result
  result_data := jsonb_build_object(
    'success', true,
    'deleted_user_id', target_user_id,
    'deleted_user_name', user_name,
    'deleted_user_email', user_email,
    'message', 'User and all associated data deleted successfully'
  );

  RETURN result_data;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'User deletion failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;