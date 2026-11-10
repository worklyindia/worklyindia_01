-- Create cleanup_inactive_users function
-- Deletes users who haven't created any profile (website or employer) within 7 days of signup

CREATE OR REPLACE FUNCTION public.cleanup_inactive_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_count integer := 0;
  v_user_id uuid;
  v_user_email text;
  deleted_users jsonb := '[]'::jsonb;
BEGIN
  -- Find and delete users who:
  -- 1. Created account more than 7 days ago
  -- 2. Have NO profile in profiles table (website user)
  -- 3. Have NO company in companies table (employer)
  
  FOR v_user_id, v_user_email IN
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    LEFT JOIN public.companies c ON c.user_id = au.id
    WHERE au.created_at < (now() - interval '7 days')
    AND p.id IS NULL
    AND c.id IS NULL
  LOOP
    -- Delete from auth.users (complete account deletion)
    DELETE FROM auth.users WHERE id = v_user_id;
    
    deleted_count := deleted_count + 1;
    deleted_users := deleted_users || jsonb_build_object(
      'user_id', v_user_id,
      'email', v_user_email
    );
  END LOOP;
  
  -- Log the cleanup operation
  INSERT INTO public.function_logs (
    function_name,
    status,
    request_data,
    response_data,
    execution_time_ms
  ) VALUES (
    'cleanup_inactive_users',
    'success',
    jsonb_build_object('trigger', 'scheduled'),
    jsonb_build_object(
      'deleted_count', deleted_count,
      'deleted_users', deleted_users,
      'cleaned_at', now()
    ),
    0
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'deleted_users', deleted_users,
    'cleaned_at', now()
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.cleanup_inactive_users() TO service_role;