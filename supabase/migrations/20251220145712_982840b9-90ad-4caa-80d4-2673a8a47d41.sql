-- Fix admin_delete_company_complete function - Remove reference to non-existent job_views table
CREATE OR REPLACE FUNCTION public.admin_delete_company_complete(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_data jsonb := '{}';
  company_record RECORD;
  jobs_deleted integer := 0;
  applications_deleted integer := 0;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete company profiles';
  END IF;

  -- Get company info first
  SELECT id, company_name, user_id INTO company_record
  FROM companies 
  WHERE companies.user_id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user_id: %', target_user_id;
  END IF;

  -- Delete job-related data in proper order
  DELETE FROM job_applications WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  GET DIAGNOSTICS applications_deleted = ROW_COUNT;
  
  DELETE FROM saved_jobs WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  DELETE FROM job_applicant_views WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  
  -- Delete jobs
  DELETE FROM jobs WHERE company_id = company_record.id;
  GET DIAGNOSTICS jobs_deleted = ROW_COUNT;
  
  -- Delete conversations and messages
  DELETE FROM chat_messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE employer_id = target_user_id
  );
  DELETE FROM conversations WHERE employer_id = target_user_id;
  
  -- Delete interviews
  DELETE FROM interview_participants WHERE interview_id IN (
    SELECT id FROM interviews WHERE host_user_id = target_user_id
  );
  DELETE FROM interviews WHERE host_user_id = target_user_id;
  
  -- Delete company-related records
  DELETE FROM company_favorites WHERE company_id = company_record.id;
  DELETE FROM company_interactions WHERE company_id = company_record.id;
  DELETE FROM company_reviews WHERE company_id = company_record.id;
  DELETE FROM company_statistics WHERE company_id = company_record.id;
  
  -- Delete employer settings and notifications
  DELETE FROM employer_settings WHERE user_id = target_user_id;
  DELETE FROM employer_notifications WHERE user_id = target_user_id;
  DELETE FROM employer_metrics WHERE user_id = target_user_id;
  DELETE FROM employer_profile_drafts WHERE user_id = target_user_id;
  
  -- Delete the company
  DELETE FROM companies WHERE id = company_record.id;
  
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
      'user_id', target_user_id,
      'jobs_deleted', jobs_deleted,
      'applications_deleted', applications_deleted
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_company', company_record.company_name,
    'user_id', target_user_id,
    'jobs_deleted', jobs_deleted,
    'applications_deleted', applications_deleted
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to delete company: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.admin_delete_company_complete(uuid) TO authenticated;