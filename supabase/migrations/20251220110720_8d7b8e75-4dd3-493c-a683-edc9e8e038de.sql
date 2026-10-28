-- ============================================================================
-- FIX: admin_delete_company_complete - jobs table uses company_id not employer_id
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_delete_company_complete(uuid);

CREATE OR REPLACE FUNCTION public.admin_delete_company_complete(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_data jsonb := '{}';
  company_record RECORD;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete company profiles';
  END IF;

  -- Get company info first
  SELECT id, company_name, user_id INTO company_record
  FROM companies 
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user_id: %', target_user_id;
  END IF;

  -- Delete related data in proper order (respecting foreign keys)
  
  -- Delete jobs and related data - FIXED: jobs.company_id not employer_id
  DELETE FROM job_applications WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  DELETE FROM saved_jobs WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  DELETE FROM job_views WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  DELETE FROM job_applicant_views WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  DELETE FROM jobs WHERE company_id = company_record.id;
  
  -- Delete interviews
  DELETE FROM interviews WHERE host_user_id = target_user_id;
  
  -- Delete conversations and messages
  DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE employer_id = target_user_id);
  DELETE FROM conversations WHERE employer_id = target_user_id;
  
  -- Delete employer-specific data
  DELETE FROM employer_settings WHERE user_id = target_user_id;
  DELETE FROM employer_notifications WHERE user_id = target_user_id;
  DELETE FROM employer_metrics WHERE user_id = target_user_id;
  DELETE FROM employer_profile_drafts WHERE user_id = target_user_id;
  
  -- Delete company related data
  DELETE FROM company_reviews WHERE company_id = company_record.id;
  DELETE FROM company_favorites WHERE company_id = company_record.id;
  DELETE FROM company_interactions WHERE company_id = company_record.id;
  DELETE FROM company_statistics WHERE company_id = company_record.id;
  
  -- Delete the company profile
  DELETE FROM companies WHERE user_id = target_user_id;
  
  -- Delete wallet data
  DELETE FROM point_adjustments WHERE user_id = target_user_id;
  DELETE FROM wallet_transactions WHERE user_id = target_user_id;
  DELETE FROM wallets WHERE user_id = target_user_id;
  
  -- Log the action
  INSERT INTO admin_audit_logs (
    performed_by,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    auth.uid()::text,
    'delete_company_complete',
    'company',
    company_record.id::text,
    jsonb_build_object(
      'company_name', company_record.company_name,
      'user_id', target_user_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_company', company_record.company_name,
    'user_id', target_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_company_complete(uuid) TO authenticated;

-- ============================================================================
-- FIX: admin_delete_user - jobs uses company_id, job_applications uses applicant_id
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);

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
  v_company_id uuid;
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
  
  -- Get company id if exists
  SELECT id INTO v_company_id FROM companies WHERE user_id = target_user_id;
  
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
  
  -- Job applications - FIXED: use applicant_id not user_id
  DELETE FROM public.job_applications WHERE applicant_id = target_user_id;
  
  -- Saved jobs
  DELETE FROM public.saved_jobs WHERE user_id = target_user_id;
  
  -- Jobs posted by this user - FIXED: use company_id not employer_id
  IF v_company_id IS NOT NULL THEN
    DELETE FROM public.job_applicant_views WHERE job_id IN (SELECT id FROM jobs WHERE company_id = v_company_id);
    DELETE FROM public.job_views WHERE job_id IN (SELECT id FROM jobs WHERE company_id = v_company_id);
    DELETE FROM public.jobs WHERE company_id = v_company_id;
  END IF;
  
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

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;