-- Fix: Change work_experiences to professional_experiences in admin_delete_website_user_data function

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

  -- Delete from professional_experiences (FIXED: was work_experiences)
  DELETE FROM professional_experiences WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('professional_experiences', v_count);

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_delete_website_user_data(uuid) TO authenticated;