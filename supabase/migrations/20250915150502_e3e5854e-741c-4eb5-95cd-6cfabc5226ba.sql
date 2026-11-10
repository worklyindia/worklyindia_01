-- Create function to automatically create user notifications for job recommendations
CREATE OR REPLACE FUNCTION create_job_recommendation_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    user_record RECORD;
    job_title TEXT;
    company_name TEXT;
    notification_count INTEGER;
BEGIN
    -- Get job details
    SELECT j.title, c.company_name 
    INTO job_title, company_name
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.id = NEW.id;
    
    -- Only create notifications for active, public jobs
    IF NEW.status = 'active' AND NEW.visibility = 'public' THEN
        -- Find users who might be interested in this job (based on skills, location, job type)
        FOR user_record IN
            SELECT DISTINCT p.user_id, p.full_name
            FROM profiles p
            WHERE p.user_id IS NOT NULL
              AND (
                -- Match by skills
                (p.skills && NEW.skills) OR
                -- Match by location
                (p.preferred_location = NEW.location) OR
                -- Match by job type
                (p.job_type = NEW.job_type) OR
                -- Match by industry/category
                (p.industry = NEW.category)
              )
              -- Don't send to job poster
              AND p.user_id != (SELECT user_id FROM companies WHERE id = NEW.company_id)
              -- Limit to users who haven't disabled job alerts
              AND EXISTS (
                SELECT 1 FROM user_settings us 
                WHERE us.user_id = p.user_id 
                AND us.job_alerts = true
              )
            LIMIT 50 -- Limit to prevent spam
        LOOP
            -- Check if user already has a notification for this job
            SELECT COUNT(*) INTO notification_count
            FROM notifications
            WHERE user_id = user_record.user_id
              AND metadata->>'job_id' = NEW.id::text
              AND type = 'job_match';
            
            -- Only create notification if none exists
            IF notification_count = 0 THEN
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    type,
                    action_url,
                    metadata
                ) VALUES (
                    user_record.user_id,
                    'New Job Match!',
                    'A new ' || job_title || ' position at ' || company_name || ' matches your profile',
                    'job_match',
                    '/job/' || NEW.id,
                    jsonb_build_object(
                        'job_id', NEW.id,
                        'job_title', job_title,
                        'company_name', company_name,
                        'match_type', 'profile_match'
                    )
                );
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create trigger for new job notifications
DROP TRIGGER IF EXISTS trigger_job_recommendation_notification ON jobs;
CREATE TRIGGER trigger_job_recommendation_notification
    AFTER INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION create_job_recommendation_notification();

-- Create function for job application status updates for applicants
CREATE OR REPLACE FUNCTION create_application_status_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    job_title TEXT;
    company_name TEXT;
    status_message TEXT;
BEGIN
    -- Only create notification if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Get job and company details
    SELECT j.title, c.company_name
    INTO job_title, company_name
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.id = NEW.job_id;
    
    -- Create appropriate message based on status
    CASE NEW.status
        WHEN 'shortlisted' THEN
            status_message := 'Great news! You have been shortlisted for ' || job_title || ' at ' || company_name;
        WHEN 'interview_scheduled' THEN
            status_message := 'Interview scheduled for ' || job_title || ' position at ' || company_name;
        WHEN 'rejected' THEN
            status_message := 'Thank you for applying to ' || job_title || ' at ' || company_name || '. We have decided to move forward with other candidates.';
        WHEN 'hired' THEN
            status_message := 'Congratulations! You have been selected for ' || job_title || ' at ' || company_name;
        ELSE
            status_message := 'Your application status for ' || job_title || ' at ' || company_name || ' has been updated to: ' || NEW.status;
    END CASE;
    
    -- Create notification for applicant
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        NEW.user_id,
        'Application Status Update',
        status_message,
        'application',
        '/job/' || NEW.job_id,
        jsonb_build_object(
            'job_id', NEW.job_id,
            'application_id', NEW.id,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'match_type', 'application'
        )
    );
    
    RETURN NEW;
END;
$function$;

-- Update existing trigger to use new function
DROP TRIGGER IF EXISTS trigger_application_status_notification ON job_applications;
CREATE TRIGGER trigger_application_status_notification
    AFTER UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION create_application_status_notification();

-- Create function for interview notifications to applicants
CREATE OR REPLACE FUNCTION create_interview_notification_for_applicant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    job_title TEXT;
    company_name TEXT;
    interview_time TEXT;
BEGIN
    -- Get job and company details
    SELECT j.title, c.company_name
    INTO job_title, company_name
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.id = NEW.job_id;
    
    -- Format interview time
    interview_time := TO_CHAR(NEW.scheduled_at, 'DD Mon YYYY at HH24:MI');
    
    -- Create notification for applicant
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        NEW.applicant_id,
        'Interview Scheduled',
        'Your interview for ' || job_title || ' at ' || company_name || ' is scheduled for ' || interview_time,
        'interview',
        '/activity',
        jsonb_build_object(
            'job_id', NEW.job_id,
            'interview_id', NEW.id,
            'scheduled_at', NEW.scheduled_at,
            'mode', NEW.mode,
            'match_type', 'application'
        )
    );
    
    RETURN NEW;
END;
$function$;

-- Create trigger for interview notifications to applicants
DROP TRIGGER IF EXISTS trigger_interview_notification_applicant ON interviews;
CREATE TRIGGER trigger_interview_notification_applicant
    AFTER INSERT ON interviews
    FOR EACH ROW
    EXECUTE FUNCTION create_interview_notification_for_applicant();