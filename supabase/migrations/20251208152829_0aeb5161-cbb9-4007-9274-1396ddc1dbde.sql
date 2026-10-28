
-- Fix admin_delete_website_user_data function with correct table names
CREATE OR REPLACE FUNCTION public.admin_delete_website_user_data(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_role text;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  -- Get the current user's ID
  v_admin_id := auth.uid();
  
  -- Check if current user is an admin
  SELECT role INTO v_admin_role
  FROM public.admin_users
  WHERE user_id = v_admin_id;
  
  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'super_admin', 'owner') THEN
    RAISE EXCEPTION 'Only admins can delete user data';
  END IF;

  -- Delete from job_favorites (not saved_jobs)
  DELETE FROM public.job_favorites WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('job_favorites', v_count);

  -- Delete job applications
  DELETE FROM public.job_applications WHERE applicant_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('job_applications', v_count);

  -- Delete education entries
  DELETE FROM public.education_entries WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('education_entries', v_count);

  -- Delete certifications
  DELETE FROM public.certifications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('certifications', v_count);

  -- Delete professional experiences
  DELETE FROM public.professional_experiences WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('professional_experiences', v_count);

  -- Delete notifications
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('notifications', v_count);

  -- Delete user settings
  DELETE FROM public.user_settings WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_settings', v_count);

  -- Delete user points
  DELETE FROM public.user_points WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_points', v_count);

  -- Delete user_referrals (not referrals, and use referred_user_id not referred_id)
  DELETE FROM public.user_referrals WHERE referrer_id = target_user_id OR referred_user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_referrals', v_count);

  -- Delete wallets
  DELETE FROM public.wallets WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('wallets', v_count);

  -- Delete profile
  DELETE FROM public.profiles WHERE id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('profiles', v_count);

  -- Log the action
  INSERT INTO public.admin_audit_logs (
    performed_by,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    v_admin_id,
    'delete_website_user_data',
    'user',
    target_user_id::text,
    v_deleted_counts
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_counts', v_deleted_counts
  );
END;
$$;

-- Fix admin_delete_company_complete function with correct table names
CREATE OR REPLACE FUNCTION public.admin_delete_company_complete(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_role text;
  v_company_id uuid;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  -- Get the current user's ID
  v_admin_id := auth.uid();
  
  -- Check if current user is an admin
  SELECT role INTO v_admin_role
  FROM public.admin_users
  WHERE user_id = v_admin_id;
  
  IF v_admin_role IS NULL OR v_admin_role NOT IN ('admin', 'super_admin', 'owner') THEN
    RAISE EXCEPTION 'Only admins can delete company data';
  END IF;

  -- Get the company ID for this user
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE user_id = target_user_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No company found for this user'
    );
  END IF;

  -- Delete job_favorites for jobs of this company (not saved_jobs)
  DELETE FROM public.job_favorites WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('job_favorites', v_count);

  -- Delete job applications for jobs of this company
  DELETE FROM public.job_applications WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('job_applications', v_count);

  -- Delete interviews for jobs of this company
  DELETE FROM public.interviews WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('interviews', v_count);

  -- Delete conversations for jobs of this company
  DELETE FROM public.conversations WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('conversations', v_count);

  -- Delete jobs
  DELETE FROM public.jobs WHERE company_id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('jobs', v_count);

  -- Delete employer settings
  DELETE FROM public.employer_settings WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('employer_settings', v_count);

  -- Delete employer notifications
  DELETE FROM public.employer_notifications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('employer_notifications', v_count);

  -- Delete company
  DELETE FROM public.companies WHERE id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('companies', v_count);

  -- Log the action
  INSERT INTO public.admin_audit_logs (
    performed_by,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    v_admin_id,
    'delete_company_complete',
    'company',
    v_company_id::text,
    v_deleted_counts
  );

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'deleted_counts', v_deleted_counts
  );
END;
$$;
