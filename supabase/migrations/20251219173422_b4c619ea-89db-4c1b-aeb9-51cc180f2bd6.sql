-- Create trigger function to create employer notification when new application comes in
CREATE OR REPLACE FUNCTION create_employer_application_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_employer_id UUID;
  v_job_title TEXT;
  v_applicant_name TEXT;
BEGIN
  -- Get employer_id from the job
  SELECT employer_id, title INTO v_employer_id, v_job_title
  FROM jobs WHERE id = NEW.job_id;
  
  -- Get applicant name (try profiles first, then guest_info)
  IF NEW.applicant_id IS NOT NULL THEN
    SELECT full_name INTO v_applicant_name FROM profiles WHERE id = NEW.applicant_id;
  END IF;
  
  IF v_applicant_name IS NULL AND NEW.guest_info IS NOT NULL THEN
    v_applicant_name := NEW.guest_info->>'name';
  END IF;
  
  IF v_applicant_name IS NULL THEN
    v_applicant_name := 'Someone';
  END IF;
  
  -- Create notification for employer
  IF v_employer_id IS NOT NULL THEN
    INSERT INTO employer_notifications (user_id, type, title, message, metadata, action_url)
    VALUES (
      v_employer_id,
      'application',
      'New Application',
      v_applicant_name || ' applied for ' || COALESCE(v_job_title, 'your job'),
      jsonb_build_object('job_id', NEW.job_id, 'application_id', NEW.id),
      '/employer?tab=jobs'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS on_new_job_application ON job_applications;
CREATE TRIGGER on_new_job_application
  AFTER INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_employer_application_notification();