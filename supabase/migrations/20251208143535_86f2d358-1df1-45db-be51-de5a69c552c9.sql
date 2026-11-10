-- Drop and recreate admin_delete_user function with proper foreign key handling
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_admin_id uuid;
BEGIN
  -- Get current admin user
  v_admin_id := auth.uid();
  
  -- Verify admin has permission (must be owner or have user management permission)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = v_admin_id 
    AND role IN ('owner', 'super_admin', 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  -- Prevent self-deletion
  IF target_user_id = v_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete your own account');
  END IF;

  -- Check if target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Handle all foreign key references BEFORE deleting user
  
  -- 1. referral_settings - set created_by to NULL
  UPDATE public.referral_settings SET created_by = NULL WHERE created_by = target_user_id;
  
  -- 2. referral_payment_settings - delete related records
  DELETE FROM public.referral_payment_settings WHERE user_id = target_user_id;
  
  -- 3. referral_withdrawals - handle both user_id and processed_by
  UPDATE public.referral_withdrawals SET processed_by = NULL WHERE processed_by = target_user_id;
  DELETE FROM public.referral_withdrawals WHERE user_id = target_user_id;
  
  -- 4. ai_generated_tricks - set generated_by to NULL (references ai_system_users, not auth.users directly)
  -- Skip this as it references ai_system_users table
  
  -- 5. system_config_history - set created_by to NULL
  UPDATE public.system_config_history SET created_by = NULL WHERE created_by = target_user_id;
  
  -- 6. job_categories - set created_by to NULL
  UPDATE public.job_categories SET created_by = NULL WHERE created_by = target_user_id;
  
  -- 7. system_config - set updated_by to NULL
  UPDATE public.system_config SET updated_by = NULL WHERE updated_by = target_user_id;
  
  -- 8. custom_roles - set created_by to NULL
  UPDATE public.custom_roles SET created_by = NULL WHERE created_by = target_user_id;
  
  -- 9. admin_users - set created_by to NULL
  UPDATE public.admin_users SET created_by = NULL WHERE created_by = target_user_id;
  
  -- 10. app_settings - set updated_by to NULL
  UPDATE public.app_settings SET updated_by = NULL WHERE updated_by = target_user_id;
  
  -- 11. Delete admin_users entry for target user
  DELETE FROM public.admin_users WHERE user_id = target_user_id;
  
  -- 12. Delete admin_permissions entry
  DELETE FROM public.admin_permissions WHERE user_id = target_user_id;
  
  -- 13. Delete from notifications
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  
  -- 14. Delete from employer_notifications
  DELETE FROM public.employer_notifications WHERE user_id = target_user_id;
  
  -- 15. Delete job applications
  DELETE FROM public.job_applications WHERE applicant_id = target_user_id;
  
  -- 16. Delete saved jobs
  DELETE FROM public.saved_jobs WHERE user_id = target_user_id;
  
  -- 17. Delete company (profile deletion trigger will handle this too)
  DELETE FROM public.companies WHERE user_id = target_user_id;
  
  -- 18. Delete profile
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  
  -- 19. Delete wallets and transactions
  DELETE FROM public.points_transactions WHERE user_id = target_user_id;
  DELETE FROM public.wallets WHERE user_id = target_user_id;
  
  -- 20. Delete notification tokens
  DELETE FROM public.notification_tokens WHERE user_id = target_user_id;
  
  -- Finally delete the user from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;

  -- Log the action
  INSERT INTO public.admin_audit_logs (
    performed_by,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    v_admin_id,
    'delete_user',
    'user',
    target_user_id::text,
    jsonb_build_object('deleted_user_id', target_user_id)
  );

  RETURN jsonb_build_object('success', true, 'message', 'User deleted successfully');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;