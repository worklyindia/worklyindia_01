-- Fix notifications trigger functions to use action_url instead of link column
-- Drop all triggers and functions in correct order

-- Drop all triggers first
DROP TRIGGER IF EXISTS create_applicant_submission_notification_trigger ON job_applications;
DROP TRIGGER IF EXISTS trg_create_applicant_submission_notification ON job_applications;
DROP TRIGGER IF EXISTS create_applicant_submission_notification ON job_applications;
DROP TRIGGER IF EXISTS create_application_status_notification_trigger ON job_applications;
DROP TRIGGER IF EXISTS create_employer_job_application_notification_with_push_trigger ON job_applications;

-- Now drop functions
DROP FUNCTION IF EXISTS create_applicant_submission_notification() CASCADE;
DROP FUNCTION IF EXISTS create_application_status_notification() CASCADE;
DROP FUNCTION IF EXISTS create_employer_job_application_notification_with_push() CASCADE;

-- Recreate Function 1: create_applicant_submission_notification
CREATE OR REPLACE FUNCTION create_applicant_submission_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
BEGIN
  SELECT j.title, c.company_name
  INTO v_job_title, v_company_name
  FROM jobs j
  LEFT JOIN companies c ON c.user_id = j.employer_id
  WHERE j.id = NEW.job_id;

  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    action_url,
    metadata
  ) VALUES (
    NEW.applicant_id,
    'Application Submitted Successfully',
    format('Your application for %s at %s has been submitted successfully. The employer will review it shortly.', 
      COALESCE(v_job_title, 'the position'),
      COALESCE(v_company_name, 'the company')
    ),
    'application_submitted',
    '/applications',
    jsonb_build_object(
      'job_id', NEW.job_id,
      'application_id', NEW.id,
      'job_title', v_job_title,
      'company_name', v_company_name
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_applicant_submission_notification_trigger
AFTER INSERT ON job_applications
FOR EACH ROW
EXECUTE FUNCTION create_applicant_submission_notification();

-- Recreate Function 2: create_application_status_notification
CREATE OR REPLACE FUNCTION create_application_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status != 'pending' THEN
    SELECT j.title, c.company_name
    INTO v_job_title, v_company_name
    FROM jobs j
    LEFT JOIN companies c ON c.user_id = j.employer_id
    WHERE j.id = NEW.job_id;

    CASE NEW.status
      WHEN 'shortlisted' THEN
        v_notification_title := 'Application Shortlisted';
        v_notification_message := format('Great news! Your application for %s at %s has been shortlisted.', 
          COALESCE(v_job_title, 'the position'),
          COALESCE(v_company_name, 'the company')
        );
      WHEN 'interview_scheduled' THEN
        v_notification_title := 'Interview Scheduled';
        v_notification_message := format('Your interview for %s at %s has been scheduled. Check your email for details.', 
          COALESCE(v_job_title, 'the position'),
          COALESCE(v_company_name, 'the company')
        );
      WHEN 'offered' THEN
        v_notification_title := 'Job Offer Received';
        v_notification_message := format('Congratulations! You have received a job offer for %s at %s.', 
          COALESCE(v_job_title, 'the position'),
          COALESCE(v_company_name, 'the company')
        );
      WHEN 'rejected' THEN
        v_notification_title := 'Application Update';
        v_notification_message := format('Thank you for your interest in %s at %s. Unfortunately, we are moving forward with other candidates.', 
          COALESCE(v_job_title, 'the position'),
          COALESCE(v_company_name, 'the company')
        );
      ELSE
        RETURN NEW;
    END CASE;

    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      action_url,
      metadata
    ) VALUES (
      NEW.applicant_id,
      v_notification_title,
      v_notification_message,
      'application_status_update',
      format('/applications/%s', NEW.id),
      jsonb_build_object(
        'job_id', NEW.job_id,
        'application_id', NEW.id,
        'status', NEW.status,
        'job_title', v_job_title,
        'company_name', v_company_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_application_status_notification_trigger
AFTER UPDATE ON job_applications
FOR EACH ROW
EXECUTE FUNCTION create_application_status_notification();

-- Recreate Function 3: create_employer_job_application_notification_with_push
CREATE OR REPLACE FUNCTION create_employer_job_application_notification_with_push()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_employer_id UUID;
  v_applicant_name TEXT;
  v_applicant_email TEXT;
  v_push_tokens TEXT[];
BEGIN
  SELECT j.title, j.employer_id
  INTO v_job_title, v_employer_id
  FROM jobs j
  WHERE j.id = NEW.job_id;

  SELECT u.full_name, u.email
  INTO v_applicant_name, v_applicant_email
  FROM profiles u
  WHERE u.user_id = NEW.applicant_id;

  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    action_url,
    metadata
  ) VALUES (
    v_employer_id,
    'New Job Application',
    format('%s has applied for %s', 
      COALESCE(v_applicant_name, 'A candidate'),
      COALESCE(v_job_title, 'your job posting')
    ),
    'new_application',
    format('/employer/applications?job_id=%s', NEW.job_id),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'application_id', NEW.id,
      'applicant_id', NEW.applicant_id,
      'applicant_name', v_applicant_name,
      'job_title', v_job_title
    )
  );

  SELECT array_agg(device_token)
  INTO v_push_tokens
  FROM push_notification_tokens
  WHERE user_id = v_employer_id
    AND is_active = true
    AND device_token IS NOT NULL;

  IF v_push_tokens IS NOT NULL AND array_length(v_push_tokens, 1) > 0 THEN
    INSERT INTO push_notification_queue (
      user_id,
      title,
      body,
      data,
      device_tokens
    ) VALUES (
      v_employer_id,
      'New Job Application',
      format('%s has applied for %s', 
        COALESCE(v_applicant_name, 'A candidate'),
        COALESCE(v_job_title, 'your job posting')
      ),
      jsonb_build_object(
        'type', 'new_application',
        'job_id', NEW.job_id,
        'application_id', NEW.id,
        'applicant_id', NEW.applicant_id
      ),
      v_push_tokens
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_employer_job_application_notification_with_push_trigger
AFTER INSERT ON job_applications
FOR EACH ROW
EXECUTE FUNCTION create_employer_job_application_notification_with_push();