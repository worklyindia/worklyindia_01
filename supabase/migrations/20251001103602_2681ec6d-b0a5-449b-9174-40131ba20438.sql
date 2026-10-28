-- Create function to check if company can post jobs
CREATE OR REPLACE FUNCTION public.check_company_can_post_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_record RECORD;
BEGIN
  -- Get company details for the user posting the job
  SELECT 
    c.job_posting_visibility,
    c.account_status,
    c.company_name,
    es.job_posting_visibility as settings_visibility
  INTO company_record
  FROM public.companies c
  LEFT JOIN public.employer_settings es ON es.user_id = c.user_id
  WHERE c.id = NEW.company_id;
  
  -- If company not found, block the posting
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found. Cannot post job.';
  END IF;
  
  -- Check if account is banned
  IF company_record.account_status = 'banned' THEN
    RAISE EXCEPTION 'Your account is banned. You cannot post jobs. Please contact support.';
  END IF;
  
  -- Check if job posting is disabled in companies table
  IF company_record.job_posting_visibility = false THEN
    RAISE EXCEPTION 'Job posting is disabled for %. You cannot post new jobs. Contact admin for assistance.', company_record.company_name;
  END IF;
  
  -- Check if job posting is disabled in employer_settings table
  IF company_record.settings_visibility = false THEN
    RAISE EXCEPTION 'Job posting privileges are disabled. You cannot post new jobs. Contact admin for assistance.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_job_posting_allowed ON public.jobs;

-- Create trigger to run before INSERT on jobs table
CREATE TRIGGER check_job_posting_allowed
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_company_can_post_jobs();