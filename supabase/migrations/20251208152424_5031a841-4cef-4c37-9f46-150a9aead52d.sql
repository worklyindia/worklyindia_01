-- Fix: Add 'owner' role to admin check in both functions

-- Update admin_delete_website_user_data function
CREATE OR REPLACE FUNCTION public.admin_delete_website_user_data(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_is_admin boolean;
  v_target_email text;
BEGIN
  -- Get the current user's ID
  v_admin_id := auth.uid();
  
  -- Check if user is admin, super_admin, OR owner
  SELECT EXISTS(
    SELECT 1 FROM admin_users 
    WHERE user_id = v_admin_id AND role IN ('admin', 'super_admin', 'owner')
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can delete user data');
  END IF;
  
  -- Get target user info for logging
  SELECT email INTO v_target_email FROM auth.users WHERE id = target_user_id;
  
  IF v_target_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Delete ONLY website user profile data (NOT the auth account, NOT company data)
  
  -- Professional experiences
  DELETE FROM public.professional_experiences WHERE user_id = target_user_id;
  
  -- Education entries
  DELETE FROM public.education_entries WHERE user_id = target_user_id;
  
  -- Certifications
  DELETE FROM public.certifications WHERE user_id = target_user_id;
  
  -- Job applications (as applicant)
  DELETE FROM public.job_applications WHERE applicant_id = target_user_id;
  
  -- Saved jobs
  DELETE FROM public.saved_jobs WHERE user_id = target_user_id;
  
  -- User notifications
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  
  -- User settings
  DELETE FROM public.user_settings WHERE user_id = target_user_id;
  
  -- Point transactions (user wallet)
  DELETE FROM public.points_transactions WHERE user_id = target_user_id;
  
  -- Referral data
  DELETE FROM public.referral_earnings WHERE user_id = target_user_id OR referred_user_id = target_user_id;
  DELETE FROM public.referrals WHERE referrer_id = target_user_id OR referred_id = target_user_id;
  UPDATE public.referral_withdrawal_requests SET processed_by = NULL WHERE processed_by = target_user_id;
  DELETE FROM public.referral_withdrawal_requests WHERE user_id = target_user_id;
  
  -- Wallet balance
  DELETE FROM public.wallets WHERE user_id = target_user_id;
  
  -- Profile (this does NOT delete auth.users)
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  
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
    'delete_website_user_data',
    'website_user',
    target_user_id,
    v_target_email,
    jsonb_build_object('deleted_at', now(), 'note', 'Profile data deleted, user account remains')
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Website user profile data deleted successfully. User account remains.');
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Update admin_delete_company_complete function
CREATE OR REPLACE FUNCTION public.admin_delete_company_complete(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_is_admin boolean;
  v_target_email text;
  v_company_id uuid;
BEGIN
  -- Get the current user's ID
  v_admin_id := auth.uid();
  
  -- Check if user is admin, super_admin, OR owner
  SELECT EXISTS(
    SELECT 1 FROM admin_users 
    WHERE user_id = v_admin_id AND role IN ('admin', 'super_admin', 'owner')
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can delete company data');
  END IF;
  
  -- Get target user info for logging
  SELECT email INTO v_target_email FROM auth.users WHERE id = target_user_id;
  
  IF v_target_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get company ID
  SELECT id INTO v_company_id FROM public.companies WHERE user_id = target_user_id LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found for this user');
  END IF;
  
  -- Delete company-related data
  
  -- Delete job applications for company's jobs
  DELETE FROM public.job_applications WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  
  -- Delete job interactions
  DELETE FROM public.job_interactions WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  
  -- Delete interviews for company's jobs
  DELETE FROM public.interviews WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  
  -- Delete saved jobs for company's jobs
  DELETE FROM public.saved_jobs WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  
  -- Delete jobs
  DELETE FROM public.jobs WHERE company_id = v_company_id;
  
  -- Delete employer notifications
  DELETE FROM public.employer_notifications WHERE user_id = target_user_id;
  
  -- Delete employer settings
  DELETE FROM public.employer_settings WHERE user_id = target_user_id;
  
  -- Delete employer metrics
  DELETE FROM public.employer_metrics WHERE user_id = target_user_id;
  
  -- Delete conversations
  DELETE FROM public.conversations WHERE employer_id = target_user_id;
  
  -- Delete company reviews
  DELETE FROM public.company_reviews WHERE company_id = v_company_id;
  
  -- Delete company favorites
  DELETE FROM public.company_favorites WHERE company_id = v_company_id;
  
  -- Delete company interactions
  DELETE FROM public.company_interactions WHERE company_id = v_company_id;
  
  -- Delete company statistics
  DELETE FROM public.company_statistics WHERE company_id = v_company_id;
  
  -- Delete company audit logs
  DELETE FROM public.company_audit_logs WHERE company_id = v_company_id;
  
  -- Finally delete the company
  DELETE FROM public.companies WHERE id = v_company_id;
  
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
    'delete_company_complete',
    'company',
    target_user_id,
    v_target_email,
    jsonb_build_object('deleted_at', now(), 'company_id', v_company_id, 'note', 'Company and related data deleted, user account remains')
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Company and related data deleted successfully. User account remains.');
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;