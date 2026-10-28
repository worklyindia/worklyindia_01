-- Fix type mismatch: Remove ::text casting from target_id in both functions
-- target_id column is uuid type, so we should pass uuid directly

-- Drop and recreate admin_delete_website_user_data with fixed target_id
CREATE OR REPLACE FUNCTION public.admin_delete_website_user_data(target_user_id uuid, admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_counts jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  -- Verify admin has permission
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = admin_user_id 
    AND role IN ('owner', 'super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  -- Delete profile-related data only (not company data)
  
  -- Delete education entries
  DELETE FROM public.education_entries WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('education_entries', v_count);

  -- Delete certifications
  DELETE FROM public.certifications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('certifications', v_count);

  -- Delete professional experiences
  DELETE FROM public.professional_experiences WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('professional_experiences', v_count);

  -- Delete job applications
  DELETE FROM public.job_applications WHERE applicant_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('job_applications', v_count);

  -- Delete job favorites (was saved_jobs)
  DELETE FROM public.job_favorites WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('job_favorites', v_count);

  -- Delete notifications
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('notifications', v_count);

  -- Delete user settings
  DELETE FROM public.user_settings WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('user_settings', v_count);

  -- Delete user points
  DELETE FROM public.user_points WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('user_points', v_count);

  -- Delete user referrals (was referrals with referred_id)
  DELETE FROM public.user_referrals WHERE referrer_id = target_user_id OR referred_user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('user_referrals', v_count);

  -- Delete wallets
  DELETE FROM public.wallets WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('wallets', v_count);

  -- Delete profile (this will NOT trigger company deletion for website users)
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('profiles', v_count);

  -- Log the action - FIXED: removed ::text from target_user_id
  INSERT INTO public.admin_audit_logs (
    performed_by,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    admin_user_id,
    'delete_website_user_data',
    'user',
    target_user_id,  -- No ::text conversion - pass uuid directly
    jsonb_build_object(
      'deleted_counts', deleted_counts,
      'deletion_type', 'website_user_profile_only'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_counts', deleted_counts,
    'message', 'Website user profile data deleted successfully'
  );
END;
$$;

-- Drop and recreate admin_delete_company_complete with fixed target_id
CREATE OR REPLACE FUNCTION public.admin_delete_company_complete(p_company_id uuid, admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_counts jsonb := '{}'::jsonb;
  v_count integer;
  v_company_id uuid := p_company_id;
  v_user_id uuid;
BEGIN
  -- Verify admin has permission
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = admin_user_id 
    AND role IN ('owner', 'super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;

  -- Get the user_id associated with this company
  SELECT user_id INTO v_user_id FROM public.companies WHERE id = v_company_id;

  -- Delete company-related data only (not profile data)

  -- Delete job favorites for jobs belonging to this company
  DELETE FROM public.job_favorites WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('job_favorites', v_count);

  -- Delete job applications for jobs belonging to this company
  DELETE FROM public.job_applications WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('job_applications', v_count);

  -- Delete interviews for jobs belonging to this company
  DELETE FROM public.interviews WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = v_company_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('interviews', v_count);

  -- Delete jobs
  DELETE FROM public.jobs WHERE company_id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('jobs', v_count);

  -- Delete employer settings
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.employer_settings WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('employer_settings', v_count);

    -- Delete employer notifications
    DELETE FROM public.employer_notifications WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('employer_notifications', v_count);

    -- Delete conversations where user is employer
    DELETE FROM public.conversations WHERE employer_id = v_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('conversations', v_count);
  END IF;

  -- Delete company reviews
  DELETE FROM public.company_reviews WHERE company_id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('company_reviews', v_count);

  -- Delete company favorites
  DELETE FROM public.company_favorites WHERE company_id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('company_favorites', v_count);

  -- Delete company interactions
  DELETE FROM public.company_interactions WHERE company_id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('company_interactions', v_count);

  -- Delete company statistics
  DELETE FROM public.company_statistics WHERE company_id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('company_statistics', v_count);

  -- Delete the company
  DELETE FROM public.companies WHERE id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('companies', v_count);

  -- Log the action - FIXED: removed ::text from v_company_id
  INSERT INTO public.admin_audit_logs (
    performed_by,
    action,
    target_type,
    target_id,
    details
  ) VALUES (
    admin_user_id,
    'delete_company_complete',
    'company',
    v_company_id,  -- No ::text conversion - pass uuid directly
    jsonb_build_object(
      'deleted_counts', deleted_counts,
      'deletion_type', 'company_data_only',
      'associated_user_id', v_user_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_counts', deleted_counts,
    'message', 'Company data deleted successfully'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_delete_website_user_data(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_company_complete(uuid, uuid) TO authenticated;