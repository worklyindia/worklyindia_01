-- Fix: Remove invalid INSERT into non-existent push_notifications table

-- Drop the problematic function with CASCADE to remove its trigger
DROP FUNCTION IF EXISTS create_employer_job_application_notification_with_push() CASCADE;

-- Recreate the function WITHOUT the invalid INSERT into push_notifications
CREATE OR REPLACE FUNCTION create_employer_job_application_notification_with_push()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_employer_id UUID;
  v_applicant_name TEXT;
BEGIN
  -- Get job and employer details
  SELECT j.title, c.user_id
  INTO v_job_title, v_employer_id
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE j.id = NEW.job_id;

  -- Get applicant name
  SELECT COALESCE(p.full_name, 'A candidate')
  INTO v_applicant_name
  FROM profiles p
  WHERE p.id = NEW.applicant_id;

  -- Create in-app notification for employer (this table exists and works)
  IF v_employer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (
      v_employer_id,
      'New Job Application',
      v_applicant_name || ' applied for ' || COALESCE(v_job_title, 'your job posting'),
      'application_received',
      '/job/' || NEW.job_id || '/applications'
    );
    
    -- REMOVED: Invalid INSERT into push_notifications table that doesn't exist
    -- Push notifications should be handled by the send-notification edge function
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_job_application_created
  AFTER INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_employer_job_application_notification_with_push();