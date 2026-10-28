-- Create a simple function to help with application insert that bypasses the cache issue
CREATE OR REPLACE FUNCTION public.submit_job_application(
  p_job_id uuid,
  p_applicant_id uuid DEFAULT NULL,
  p_cover_letter text DEFAULT NULL,
  p_api_full_name text DEFAULT NULL,
  p_api_whatsapp_number text DEFAULT NULL,
  p_api_email text DEFAULT NULL,
  p_api_phone text DEFAULT NULL,
  p_api_bio text DEFAULT NULL,
  p_api_location text DEFAULT NULL,
  p_application_source text DEFAULT 'website'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employer_id uuid;
  v_application_id uuid;
BEGIN
  -- Get employer_id from the job's company
  SELECT c.user_id INTO v_employer_id
  FROM jobs j
  JOIN companies c ON j.company_id = c.id
  WHERE j.id = p_job_id;
  
  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Unable to find employer for this job';
  END IF;
  
  -- Check if already applied (for logged-in users)
  IF p_applicant_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM job_applications 
      WHERE job_id = p_job_id AND applicant_id = p_applicant_id
    ) THEN
      RAISE EXCEPTION 'You have already applied for this job';
    END IF;
  END IF;
  
  -- Insert the application
  INSERT INTO job_applications (
    job_id,
    applicant_id,
    employer_id,
    cover_letter,
    api_full_name,
    api_whatsapp_number,
    api_email,
    api_phone,
    api_bio,
    api_location,
    application_source,
    status
  ) VALUES (
    p_job_id,
    p_applicant_id,
    v_employer_id,
    p_cover_letter,
    p_api_full_name,
    p_api_whatsapp_number,
    p_api_email,
    p_api_phone,
    p_api_bio,
    p_api_location,
    p_application_source,
    'applied'
  )
  RETURNING id INTO v_application_id;
  
  -- Update job application count
  UPDATE jobs 
  SET applications_count = COALESCE(applications_count, 0) + 1,
      updated_at = now()
  WHERE id = p_job_id;
  
  RETURN v_application_id;
END;
$$;

-- Grant execute to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.submit_job_application TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_job_application TO anon;