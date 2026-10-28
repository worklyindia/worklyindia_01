-- Fix database functions to use correct table relationships
-- Drop triggers first
DROP TRIGGER IF EXISTS on_application_submitted ON job_applications;
DROP TRIGGER IF EXISTS on_application_status_changed ON job_applications;
DROP TRIGGER IF EXISTS on_job_application_created ON job_applications;

-- Drop functions with CASCADE
DROP FUNCTION IF EXISTS create_applicant_submission_notification() CASCADE;
DROP FUNCTION IF EXISTS create_application_status_notification() CASCADE;
DROP FUNCTION IF EXISTS create_employer_job_application_notification_with_push() CASCADE;

-- Recreate Function 1: Applicant submission notification (FIXED)
CREATE OR REPLACE FUNCTION create_applicant_submission_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
BEGIN
  SELECT j.title, c.company_name
  INTO v_job_title, v_company_name
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE j.id = NEW.job_id;

  INSERT INTO notifications (user_id, title, message, type, action_url)
  VALUES (
    NEW.applicant_id,
    'Application Submitted',
    'Your application for ' || COALESCE(v_job_title, 'the position') || 
    ' at ' || COALESCE(v_company_name, 'the company') || ' has been submitted successfully',
    'application_submitted',
    '/job/' || NEW.job_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Function 2: Application status notification (FIXED)
CREATE OR REPLACE FUNCTION create_application_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
  v_status_message TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT j.title, c.company_name
    INTO v_job_title, v_company_name
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.id = NEW.job_id;

    CASE NEW.status
      WHEN 'reviewing' THEN
        v_status_message := 'Your application is now being reviewed';
      WHEN 'shortlisted' THEN
        v_status_message := 'Congratulations! You have been shortlisted';
      WHEN 'rejected' THEN
        v_status_message := 'Your application was not selected this time';
      WHEN 'accepted' THEN
        v_status_message := 'Congratulations! Your application has been accepted';
      ELSE
        v_status_message := 'Your application status has been updated to ' || NEW.status;
    END CASE;

    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (
      NEW.applicant_id,
      'Application Status Update',
      v_status_message || ' for ' || COALESCE(v_job_title, 'the position') || 
      ' at ' || COALESCE(v_company_name, 'the company'),
      'application_status_changed',
      '/job/' || NEW.job_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Function 3: Employer notification with push (FIXED)
CREATE OR REPLACE FUNCTION create_employer_job_application_notification_with_push()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_employer_id UUID;
  v_applicant_name TEXT;
BEGIN
  SELECT j.title, c.user_id
  INTO v_job_title, v_employer_id
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE j.id = NEW.job_id;

  SELECT COALESCE(p.full_name, 'A candidate')
  INTO v_applicant_name
  FROM profiles p
  WHERE p.id = NEW.applicant_id;

  IF v_employer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (
      v_employer_id,
      'New Job Application',
      v_applicant_name || ' applied for ' || COALESCE(v_job_title, 'your job posting'),
      'application_received',
      '/job/' || NEW.job_id || '/applications'
    );

    INSERT INTO push_notifications (user_id, title, body, data)
    VALUES (
      v_employer_id,
      'New Job Application',
      v_applicant_name || ' applied for ' || COALESCE(v_job_title, 'your job posting'),
      jsonb_build_object(
        'type', 'application_received',
        'job_id', NEW.job_id,
        'application_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate all triggers
CREATE TRIGGER on_application_submitted
  AFTER INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_applicant_submission_notification();

CREATE TRIGGER on_application_status_changed
  AFTER UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_application_status_notification();

CREATE TRIGGER on_job_application_created
  AFTER INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_employer_job_application_notification_with_push();