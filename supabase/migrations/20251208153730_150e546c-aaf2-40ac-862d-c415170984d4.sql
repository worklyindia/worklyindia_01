-- Fix type mismatch: Remove ::text conversion from target_id in both functions

-- Recreate admin_delete_website_user_data function with corrected target_id
CREATE OR REPLACE FUNCTION public.admin_delete_website_user_data(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  -- Get the current admin user
  v_admin_id := auth.uid();
  
  -- Check if current user is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = v_admin_id 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete user data';
  END IF;

  -- Delete from profiles
  DELETE FROM profiles WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('profiles', v_count);

  -- Delete from education_entries
  DELETE FROM education_entries WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('education_entries', v_count);

  -- Delete from certifications
  DELETE FROM certifications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('certifications', v_count);

  -- Delete from work_experiences
  DELETE FROM work_experiences WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('work_experiences', v_count);

  -- Delete from job_applications
  DELETE FROM job_applications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('job_applications', v_count);

  -- Delete from saved_jobs
  DELETE FROM saved_jobs WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('saved_jobs', v_count);

  -- Delete from notifications
  DELETE FROM notifications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('notifications', v_count);

  -- Delete from user_settings
  DELETE FROM user_settings WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_settings', v_count);

  -- Delete from user_points
  DELETE FROM user_points WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('user_points', v_count);

  -- Delete from referrals (as referrer)
  DELETE FROM referrals WHERE referrer_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('referrals_as_referrer', v_count);

  -- Delete from wallets
  DELETE FROM wallets WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('wallets', v_count);

  -- Log the deletion in admin_audit_logs
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
    target_user_id,
    v_deleted_counts
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_counts', v_deleted_counts,
    'target_user_id', target_user_id
  );
END;
$$;

-- Recreate admin_delete_company_complete function with corrected target_id
CREATE OR REPLACE FUNCTION public.admin_delete_company_complete(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_company_id uuid;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_count integer;
BEGIN
  -- Get the current admin user
  v_admin_id := auth.uid();
  
  -- Check if current user is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = v_admin_id 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete company data';
  END IF;

  -- Get the company_id for this user
  SELECT id INTO v_company_id FROM companies WHERE user_id = target_user_id;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found for this user';
  END IF;

  -- Delete jobs posted by this company
  DELETE FROM jobs WHERE company_id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('jobs', v_count);

  -- Delete employer_settings
  DELETE FROM employer_settings WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('employer_settings', v_count);

  -- Delete employer_notifications
  DELETE FROM employer_notifications WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('employer_notifications', v_count);

  -- Delete interviews where host_user_id matches
  DELETE FROM interviews WHERE host_user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('interviews', v_count);

  -- Delete conversations where employer_id matches
  DELETE FROM conversations WHERE employer_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('conversations', v_count);

  -- Delete the company record
  DELETE FROM companies WHERE id = v_company_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('companies', v_count);

  -- Log the deletion in admin_audit_logs
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
    v_company_id,
    v_deleted_counts
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_counts', v_deleted_counts,
    'company_id', v_company_id,
    'target_user_id', target_user_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_delete_website_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_company_complete(uuid) TO authenticated;