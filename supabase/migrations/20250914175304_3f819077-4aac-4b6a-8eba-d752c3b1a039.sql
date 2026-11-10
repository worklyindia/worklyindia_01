-- Create comprehensive company deletion function
CREATE OR REPLACE FUNCTION public.admin_delete_company_complete(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'Company deleted by admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_company_name TEXT;
  v_jobs_count INTEGER := 0;
  v_applications_count INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Get company details
  SELECT id, company_name INTO v_company_id, v_company_name
  FROM companies 
  WHERE user_id = p_user_id;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company not found for user %', p_user_id;
  END IF;
  
  -- Count jobs before deletion
  SELECT COUNT(*) INTO v_jobs_count
  FROM jobs 
  WHERE company_id = v_company_id;
  
  -- Count applications before deletion
  SELECT COUNT(*) INTO v_applications_count
  FROM job_applications ja
  JOIN jobs j ON j.id = ja.job_id
  WHERE j.company_id = v_company_id;
  
  -- 1. Set all company jobs to deleted status
  UPDATE jobs 
  SET 
    status = 'deleted',
    visibility = 'private',
    is_boosted = false,
    boost_start_date = NULL,
    boost_end_date = NULL,
    boost_level = 0,
    updated_at = NOW()
  WHERE company_id = v_company_id;
  
  -- 2. Update job applications status
  UPDATE job_applications 
  SET 
    status = 'withdrawn',
    reviewed_at = NOW()
  WHERE job_id IN (
    SELECT id FROM jobs WHERE company_id = v_company_id
  );
  
  -- 3. Expire active job boosts
  UPDATE job_boosts 
  SET 
    status = 'expired',
    boost_end_date = NOW(),
    updated_at = NOW()
  WHERE job_id IN (
    SELECT id FROM jobs WHERE company_id = v_company_id
  ) AND status = 'active';
  
  -- 4. Set company account status to deleted
  UPDATE companies 
  SET 
    account_status = 'deleted',
    account_status_reason = p_reason,
    is_verified = false,
    verified_plan_start = NULL,
    verified_plan_end = NULL,
    badge_color = NULL,
    updated_at = NOW()
  WHERE id = v_company_id;
  
  -- 5. Disable employer settings
  UPDATE employer_settings 
  SET 
    job_posting_visibility = false,
    company_visibility = false,
    contact_visibility = false,
    show_in_directory = false,
    allow_direct_contact = false,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- 6. Create audit log entry
  INSERT INTO admin_audit_logs (
    admin_id,
    action_type,
    target_id,
    target_type,
    old_values,
    new_values,
    reason,
    metadata
  ) VALUES (
    auth.uid(),
    'company_delete',
    v_company_id,
    'company',
    jsonb_build_object(
      'company_name', v_company_name,
      'account_status', 'active'
    ),
    jsonb_build_object(
      'account_status', 'deleted',
      'jobs_affected', v_jobs_count,
      'applications_affected', v_applications_count
    ),
    p_reason,
    jsonb_build_object(
      'deletion_timestamp', NOW(),
      'jobs_deleted', v_jobs_count,
      'applications_updated', v_applications_count
    )
  );
  
  -- Return summary
  v_result := jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'company_name', v_company_name,
    'jobs_affected', v_jobs_count,
    'applications_affected', v_applications_count,
    'reason', p_reason,
    'deleted_at', NOW()
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO function_logs (
      function_name,
      status,
      error_message,
      request_data,
      created_at
    ) VALUES (
      'admin_delete_company_complete',
      'error',
      SQLERRM,
      jsonb_build_object(
        'user_id', p_user_id,
        'reason', p_reason
      ),
      NOW()
    );
    
    RAISE EXCEPTION 'Company deletion failed: %', SQLERRM;
END;
$$;