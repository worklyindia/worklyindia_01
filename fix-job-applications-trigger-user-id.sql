-- ============================================================================
-- 🚨 URGENT FIX: Job Applications Triggers - "user_id" Field Name Issue
-- ============================================================================
-- 
-- ❌ CURRENT ERROR: "record 'new' has no field 'user_id'"
-- 📍 LOCATION: Multiple triggers on job_applications table
-- 🐛 BUG: Triggers reference NEW.user_id but column is named applicant_id
-- ✅ FIX: Replace all NEW.user_id with NEW.applicant_id
-- 
-- ============================================================================
-- 📋 STEP-BY-STEP INSTRUCTIONS TO FIX:
-- ============================================================================
-- 
-- 1. COPY this entire SQL code (Ctrl+A, Ctrl+C)
-- 2. OPEN Supabase SQL Editor: 
--    https://supabase.com/dashboard/project/jubwzelupbntbetpajqb/sql/new
-- 3. PASTE the code in the SQL Editor
-- 4. CLICK the green "RUN" button
-- 5. WAIT for "Success. No rows returned" message
-- 6. TEST the API endpoint again
-- 
-- ============================================================================
-- THIS SQL WILL:
-- - Drop all broken trigger functions
-- - Recreate them with correct field names (applicant_id instead of user_id)
-- - Maintain all security and functionality
-- ============================================================================

-- =============================================================================
-- 1. Fix: check_account_status_before_application
-- =============================================================================
DROP FUNCTION IF EXISTS public.check_account_status_before_application() CASCADE;

CREATE OR REPLACE FUNCTION public.check_account_status_before_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_banned boolean;
BEGIN
  SELECT is_banned INTO v_is_banned
  FROM profiles
  WHERE user_id = NEW.applicant_id;
  
  IF v_is_banned = true THEN
    RAISE EXCEPTION 'Your account has been banned and cannot submit applications';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS check_account_status_before_application ON job_applications;
CREATE TRIGGER check_account_status_before_application
  BEFORE INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION check_account_status_before_application();

-- =============================================================================
-- 2. Fix: create_employer_job_application_notification_with_push
-- =============================================================================
DROP FUNCTION IF EXISTS public.create_employer_job_application_notification_with_push() CASCADE;

CREATE OR REPLACE FUNCTION public.create_employer_job_application_notification_with_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
  v_applicant_name TEXT;
  v_company_name TEXT;
  v_push_tokens TEXT[];
  v_token TEXT;
  v_payload jsonb;
BEGIN
  SELECT title INTO v_job_title
  FROM jobs
  WHERE id = NEW.job_id;
  
  SELECT full_name INTO v_applicant_name
  FROM profiles
  WHERE user_id = NEW.applicant_id;
  
  SELECT company_name INTO v_company_name
  FROM companies
  WHERE user_id = NEW.employer_id;
  
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    link,
    metadata
  ) VALUES (
    NEW.employer_id,
    'New Application Received',
    COALESCE(v_applicant_name, 'A candidate') || ' has applied for ' || COALESCE(v_job_title, 'your job posting'),
    'application_received',
    '/employer/applications/' || NEW.id,
    jsonb_build_object(
      'job_id', NEW.job_id,
      'application_id', NEW.id,
      'applicant_id', NEW.applicant_id,
      'job_title', v_job_title,
      'applicant_name', v_applicant_name
    )
  );
  
  SELECT array_agg(push_token)
  INTO v_push_tokens
  FROM push_subscriptions
  WHERE user_id = NEW.employer_id
    AND push_token IS NOT NULL;
  
  IF v_push_tokens IS NOT NULL AND array_length(v_push_tokens, 1) > 0 THEN
    v_payload := jsonb_build_object(
      'title', 'New Application Received',
      'body', COALESCE(v_applicant_name, 'A candidate') || ' applied for ' || COALESCE(v_job_title, 'your job'),
      'data', jsonb_build_object(
        'type', 'application_received',
        'application_id', NEW.id,
        'job_id', NEW.job_id,
        'url', '/employer/applications/' || NEW.id
      )
    );
    
    FOREACH v_token IN ARRAY v_push_tokens
    LOOP
      INSERT INTO push_notification_queue (
        user_id,
        push_token,
        title,
        body,
        data
      ) VALUES (
        NEW.employer_id,
        v_token,
        'New Application Received',
        COALESCE(v_applicant_name, 'A candidate') || ' applied for ' || COALESCE(v_job_title, 'your job'),
        jsonb_build_object(
          'type', 'application_received',
          'application_id', NEW.id,
          'job_id', NEW.job_id,
          'url', '/employer/applications/' || NEW.id
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_employer_job_application_notification_with_push ON job_applications;
CREATE TRIGGER create_employer_job_application_notification_with_push
  AFTER INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_employer_job_application_notification_with_push();

-- =============================================================================
-- 3. Fix: create_applicant_submission_notification
-- =============================================================================
DROP FUNCTION IF EXISTS public.create_applicant_submission_notification() CASCADE;

CREATE OR REPLACE FUNCTION public.create_applicant_submission_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
BEGIN
  SELECT j.title, c.company_name
  INTO v_job_title, v_company_name
  FROM jobs j
  LEFT JOIN companies c ON c.user_id = j.user_id
  WHERE j.id = NEW.job_id;
  
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    link,
    metadata
  ) VALUES (
    NEW.applicant_id,
    'Application Submitted',
    'Your application for ' || COALESCE(v_job_title, 'the position') || 
    ' at ' || COALESCE(v_company_name, 'the company') || ' has been submitted successfully',
    'application_submitted',
    '/job-seeker/applications/' || NEW.id,
    jsonb_build_object(
      'job_id', NEW.job_id,
      'application_id', NEW.id,
      'job_title', v_job_title,
      'company_name', v_company_name
    )
  );
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_applicant_submission_notification ON job_applications;
CREATE TRIGGER create_applicant_submission_notification
  AFTER INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_applicant_submission_notification();

-- =============================================================================
-- 4. Fix: create_application_status_notification
-- =============================================================================
DROP FUNCTION IF EXISTS public.create_application_status_notification() CASCADE;

CREATE OR REPLACE FUNCTION public.create_application_status_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
  v_status_message TEXT;
BEGIN
  IF OLD.status != NEW.status THEN
    SELECT j.title, c.company_name
    INTO v_job_title, v_company_name
    FROM jobs j
    LEFT JOIN companies c ON c.user_id = j.user_id
    WHERE j.id = NEW.job_id;
    
    CASE NEW.status
      WHEN 'under_review' THEN
        v_status_message := 'Your application is now under review';
      WHEN 'shortlisted' THEN
        v_status_message := 'Congratulations! You have been shortlisted';
      WHEN 'interview_scheduled' THEN
        v_status_message := 'An interview has been scheduled';
      WHEN 'offered' THEN
        v_status_message := 'Congratulations! You have received a job offer';
      WHEN 'rejected' THEN
        v_status_message := 'Your application status has been updated';
      WHEN 'withdrawn' THEN
        v_status_message := 'Your application has been withdrawn';
      ELSE
        v_status_message := 'Your application status has been updated to ' || NEW.status;
    END CASE;
    
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      link,
      metadata
    ) VALUES (
      NEW.applicant_id,
      'Application Status Update',
      v_status_message || ' for ' || COALESCE(v_job_title, 'your application') || 
      ' at ' || COALESCE(v_company_name, 'the company'),
      'application_status_changed',
      '/job-seeker/applications/' || NEW.id,
      jsonb_build_object(
        'job_id', NEW.job_id,
        'application_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'job_title', v_job_title,
        'company_name', v_company_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_application_status_notification ON job_applications;
CREATE TRIGGER create_application_status_notification
  AFTER UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_application_status_notification();

-- =============================================================================
-- 5. Fix: create_job_application_notification
-- =============================================================================
DROP FUNCTION IF EXISTS public.create_job_application_notification() CASCADE;

CREATE OR REPLACE FUNCTION public.create_job_application_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
  v_applicant_name TEXT;
BEGIN
  SELECT title INTO v_job_title
  FROM jobs
  WHERE id = NEW.job_id;
  
  SELECT full_name INTO v_applicant_name
  FROM profiles
  WHERE user_id = NEW.applicant_id;
  
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    link
  ) VALUES (
    NEW.employer_id,
    'New Job Application',
    COALESCE(v_applicant_name, 'A candidate') || ' has applied for ' || COALESCE(v_job_title, 'your job posting'),
    'application_received',
    '/job/' || NEW.job_id || '/applications'
  );
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS create_job_application_notification ON job_applications;
CREATE TRIGGER create_job_application_notification
  AFTER INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_job_application_notification();

-- =============================================================================
-- 6. Fix: send_applicant_push_notification
-- =============================================================================
DROP FUNCTION IF EXISTS public.send_applicant_push_notification() CASCADE;

CREATE OR REPLACE FUNCTION public.send_applicant_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
  v_push_tokens TEXT[];
  v_token TEXT;
  v_message TEXT;
BEGIN
  IF OLD.status != NEW.status AND NEW.status IN ('shortlisted', 'interview_scheduled', 'offered', 'rejected') THEN
    SELECT j.title, c.company_name
    INTO v_job_title, v_company_name
    FROM jobs j
    LEFT JOIN companies c ON c.user_id = j.user_id
    WHERE j.id = NEW.job_id;
    
    CASE NEW.status
      WHEN 'shortlisted' THEN
        v_message := 'You have been shortlisted for ' || COALESCE(v_job_title, 'the position');
      WHEN 'interview_scheduled' THEN
        v_message := 'Interview scheduled for ' || COALESCE(v_job_title, 'the position');
      WHEN 'offered' THEN
        v_message := 'Job offer received for ' || COALESCE(v_job_title, 'the position');
      WHEN 'rejected' THEN
        v_message := 'Application status updated for ' || COALESCE(v_job_title, 'the position');
      ELSE
        v_message := 'Application status updated';
    END CASE;
    
    SELECT array_agg(push_token)
    INTO v_push_tokens
    FROM push_subscriptions
    WHERE user_id = NEW.applicant_id
      AND push_token IS NOT NULL;
    
    IF v_push_tokens IS NOT NULL AND array_length(v_push_tokens, 1) > 0 THEN
      FOREACH v_token IN ARRAY v_push_tokens
      LOOP
        INSERT INTO push_notification_queue (
          user_id,
          push_token,
          title,
          body,
          data
        ) VALUES (
          NEW.applicant_id,
          v_token,
          'Application Status Update',
          v_message,
          jsonb_build_object(
            'type', 'application_status_changed',
            'application_id', NEW.id,
            'job_id', NEW.job_id,
            'status', NEW.status,
            'url', '/job-seeker/applications/' || NEW.id
          )
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS send_applicant_push_notification ON job_applications;
CREATE TRIGGER send_applicant_push_notification
  AFTER UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION send_applicant_push_notification();

-- =============================================================================
-- 7. Fix: update_employer_metrics
-- =============================================================================
DROP FUNCTION IF EXISTS public.update_employer_metrics() CASCADE;

CREATE OR REPLACE FUNCTION public.update_employer_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE employer_metrics
    SET 
      total_applications = total_applications + 1,
      updated_at = now()
    WHERE user_id = NEW.employer_id;
    
    IF NOT FOUND THEN
      INSERT INTO employer_metrics (user_id, total_applications)
      VALUES (NEW.employer_id, 1);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'shortlisted' THEN
      UPDATE employer_metrics
      SET 
        shortlisted_count = shortlisted_count + 1,
        updated_at = now()
      WHERE user_id = NEW.employer_id;
    ELSIF NEW.status = 'interview_scheduled' THEN
      UPDATE employer_metrics
      SET 
        interviews_scheduled = interviews_scheduled + 1,
        updated_at = now()
      WHERE user_id = NEW.employer_id;
    ELSIF NEW.status = 'offered' THEN
      UPDATE employer_metrics
      SET 
        offers_made = offers_made + 1,
        updated_at = now()
      WHERE user_id = NEW.employer_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE employer_metrics
    SET 
      total_applications = GREATEST(0, total_applications - 1),
      updated_at = now()
    WHERE user_id = OLD.employer_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS update_employer_metrics ON job_applications;
CREATE TRIGGER update_employer_metrics
  AFTER INSERT OR UPDATE OR DELETE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_employer_metrics();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully fixed all 7 trigger functions - user_id/applicant_id issue resolved!';
  RAISE NOTICE '✅ All triggers recreated and attached to job_applications table';
  RAISE NOTICE '✅ You can now test the API endpoint: /api/applications';
END $$;
