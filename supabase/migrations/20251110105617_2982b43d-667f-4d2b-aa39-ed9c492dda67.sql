
-- Fix: Replace NEW.user_id with NEW.applicant_id in check_account_status_before_application
DROP TRIGGER IF EXISTS check_account_status_before_application ON public.job_applications;

CREATE OR REPLACE FUNCTION public.check_account_status_before_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_account_status text;
BEGIN
  -- Get user's account status (fixed: use NEW.applicant_id instead of NEW.user_id)
  SELECT account_status INTO user_account_status
  FROM public.profiles
  WHERE user_id = NEW.applicant_id;
  
  -- Check if user is banned from applying to jobs
  IF user_account_status = 'job_banned' THEN
    RAISE EXCEPTION 'You are banned from applying to jobs. Please contact support for assistance.';
  END IF;
  
  -- Check if user is completely banned
  IF user_account_status = 'banned' THEN
    RAISE EXCEPTION 'Your account is banned. Please contact support for assistance.';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_account_status_before_application
  BEFORE INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_account_status_before_application();

-- Fix: Replace NEW.user_id with NEW.applicant_id in create_applicant_submission_notification
DROP TRIGGER IF EXISTS create_applicant_submission_notification ON public.job_applications;

CREATE OR REPLACE FUNCTION public.create_applicant_submission_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link
  ) VALUES (
    NEW.applicant_id,  -- Fixed: use NEW.applicant_id instead of NEW.user_id
    'Application Submitted',
    'Your application has been submitted successfully',
    'application_submitted',
    '/applications/' || NEW.id
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_applicant_submission_notification
  AFTER INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.create_applicant_submission_notification();

-- Fix: Replace NEW.user_id with NEW.applicant_id in create_application_status_notification
DROP TRIGGER IF EXISTS create_application_status_notification ON public.job_applications;

CREATE OR REPLACE FUNCTION public.create_application_status_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      link
    ) VALUES (
      NEW.applicant_id,  -- Fixed: use NEW.applicant_id instead of NEW.user_id
      'Application Status Updated',
      'Your application status has been updated to: ' || NEW.status,
      'application_status_updated',
      '/applications/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_application_status_notification
  AFTER UPDATE ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.create_application_status_notification();

-- Fix: Replace NEW.user_id with NEW.applicant_id in create_employer_job_application_notification_with_push
DROP TRIGGER IF EXISTS create_employer_job_application_notification_with_push ON public.job_applications;

CREATE OR REPLACE FUNCTION public.create_employer_job_application_notification_with_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_title text;
  v_company_name text;
  v_applicant_name text;
  v_employer_id uuid;
BEGIN
  SELECT 
    j.title,
    c.company_name,
    j.user_id
  INTO 
    v_job_title,
    v_company_name,
    v_employer_id
  FROM public.jobs j
  LEFT JOIN public.companies c ON j.company_id = c.id
  WHERE j.id = NEW.job_id;

  SELECT p.full_name
  INTO v_applicant_name
  FROM public.profiles p
  WHERE p.user_id = NEW.applicant_id;  -- Fixed: use NEW.applicant_id instead of NEW.user_id

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link,
    metadata
  ) VALUES (
    v_employer_id,
    'New Job Application',
    v_applicant_name || ' applied for ' || v_job_title,
    'application_received',
    '/job/' || NEW.job_id || '/applications',
    jsonb_build_object(
      'job_id', NEW.job_id,
      'application_id', NEW.id,
      'applicant_id', NEW.applicant_id,  -- Fixed: use NEW.applicant_id instead of NEW.user_id
      'job_title', v_job_title,
      'company_name', v_company_name,
      'applicant_name', v_applicant_name
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER create_employer_job_application_notification_with_push
  AFTER INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.create_employer_job_application_notification_with_push();
