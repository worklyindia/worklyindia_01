CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_is_super_admin boolean;
  v_target_email text;
  v_target_role text;
BEGIN
  -- Get the current user's ID
  v_admin_id := auth.uid();
  
  -- Check if user is super_admin
  SELECT EXISTS(
    SELECT 1 FROM admin_users 
    WHERE user_id = v_admin_id AND role = 'super_admin'
  ) INTO v_is_super_admin;
  
  IF NOT v_is_super_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admins can delete users');
  END IF;
  
  -- Get target user info for logging
  SELECT email INTO v_target_email FROM auth.users WHERE id = target_user_id;
  SELECT role INTO v_target_role FROM profiles WHERE id = target_user_id;
  
  IF v_target_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Delete related data in correct order (handle foreign keys)
  
  -- Referral withdrawal requests (FIXED: correct table name)
  UPDATE public.referral_withdrawal_requests SET processed_by = NULL WHERE processed_by = target_user_id;
  DELETE FROM public.referral_withdrawal_requests WHERE user_id = target_user_id;
  
  -- Referral earnings
  DELETE FROM public.referral_earnings WHERE user_id = target_user_id OR referred_user_id = target_user_id;
  
  -- Referrals (as referrer or referred)
  DELETE FROM public.referrals WHERE referrer_id = target_user_id OR referred_id = target_user_id;
  
  -- Point transactions
  DELETE FROM public.point_transactions WHERE user_id = target_user_id;
  
  -- Job applications
  DELETE FROM public.job_applications WHERE user_id = target_user_id;
  
  -- Saved jobs
  DELETE FROM public.saved_jobs WHERE user_id = target_user_id;
  
  -- Jobs posted by this user
  DELETE FROM public.jobs WHERE employer_id = target_user_id;
  
  -- Company data
  DELETE FROM public.companies WHERE user_id = target_user_id;
  
  -- Interviews (as host or applicant)
  DELETE FROM public.interviews WHERE host_user_id = target_user_id OR applicant_id = target_user_id;
  
  -- Conversations
  DELETE FROM public.conversations WHERE employer_id = target_user_id OR applicant_id = target_user_id;
  
  -- Notifications
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  DELETE FROM public.employer_notifications WHERE user_id = target_user_id;
  
  -- Settings
  DELETE FROM public.employer_settings WHERE user_id = target_user_id;
  DELETE FROM public.user_settings WHERE user_id = target_user_id;
  
  -- Admin users entry if exists
  DELETE FROM public.admin_users WHERE user_id = target_user_id;
  
  -- Profile (this should cascade delete company via trigger)
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- Finally delete the auth user
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- Log the action
  INSERT INTO admin_audit_logs (
    performed_by,
    action,
    target_type,
    target_id,
    target_email,
    details
  ) VALUES (
    v_admin_id,
    'delete_user',
    v_target_role,
    target_user_id,
    v_target_email,
    jsonb_build_object('deleted_at', now())
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'User deleted successfully');
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;