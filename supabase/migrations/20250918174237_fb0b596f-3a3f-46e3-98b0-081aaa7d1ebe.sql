-- Create function to insert a notification for applicant on job apply
CREATE OR REPLACE FUNCTION public.create_applicant_submission_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  job_title TEXT;
  company_name TEXT;
BEGIN
  -- Get job and company details
  SELECT j.title, c.company_name
    INTO job_title, company_name
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE j.id = NEW.job_id;

  -- Insert notification for the applicant
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    action_url,
    metadata
  ) VALUES (
    NEW.user_id,
    'Application Submitted',
    COALESCE('Your application for ' || job_title || ' at ' || company_name || ' has been submitted successfully.', 'Your application has been submitted successfully.'),
    'application',
    '/job/' || NEW.job_id,
    jsonb_build_object(
      'job_id', NEW.job_id,
      'application_id', NEW.id,
      'match_type', 'application'
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_create_applicant_submission_notification'
  ) THEN
    CREATE TRIGGER trg_create_applicant_submission_notification
    AFTER INSERT ON public.job_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.create_applicant_submission_notification();
  END IF;
END $$;

-- Create RPC to generate recommendation notifications for a user
CREATE OR REPLACE FUNCTION public.create_recommendation_notifications_for_user(p_user_id uuid, p_limit integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Insert up to p_limit recommendation notifications that haven't been notified in the last 24 hours
  INSERT INTO public.notifications (user_id, title, message, type, action_url, metadata)
  SELECT 
    p_user_id,
    'New Job Recommendation',
    'We found a job that matches your profile: ' || j.title || ' at ' || COALESCE(c.company_name, ''),
    'info',
    '/jobs',
    jsonb_build_object(
      'job_id', j.id,
      'match_type', 'profile_match'
    )
  FROM (
    SELECT * FROM public.get_recommended_jobs(p_user_id) LIMIT p_limit
  ) r
  JOIN public.jobs j ON j.id = r.job_id
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.metadata->>'job_id' = j.id::text
      AND n.metadata->>'match_type' = 'profile_match'
      AND n.created_at > now() - interval '24 hours'
  );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN COALESCE(inserted_count, 0);
END;
$$;