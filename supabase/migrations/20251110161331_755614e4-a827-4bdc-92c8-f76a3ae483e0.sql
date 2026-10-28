-- Fix: Update trigger functions to use NEW.applicant_id instead of NEW.user_id

-- Drop and recreate create_job_application_notification function
DROP FUNCTION IF EXISTS public.create_job_application_notification() CASCADE;

CREATE OR REPLACE FUNCTION public.create_job_application_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    job_title TEXT;
    company_name TEXT;
    employer_id UUID;
BEGIN
    -- Get job and company details
    SELECT j.title, c.company_name, c.user_id 
    INTO job_title, company_name, employer_id
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.id = NEW.job_id;
    
    -- Create notification for employer
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        employer_id,
        'New Job Application',
        'Someone applied for your ' || job_title || ' position',
        'application',
        '/job/' || NEW.job_id || '/applicants',
        jsonb_build_object(
            'job_id', NEW.job_id,
            'application_id', NEW.id,
            'applicant_id', NEW.applicant_id  -- FIXED: Changed from NEW.user_id
        )
    );
    
    RETURN NEW;
END;
$function$;

-- Recreate trigger for create_job_application_notification
DROP TRIGGER IF EXISTS job_application_notification_trigger ON public.job_applications;
CREATE TRIGGER job_application_notification_trigger
    AFTER INSERT ON public.job_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.create_job_application_notification();

-- Drop and recreate send_applicant_push_notification function
DROP FUNCTION IF EXISTS public.send_applicant_push_notification() CASCADE;

CREATE OR REPLACE FUNCTION public.send_applicant_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    job_title TEXT;
    applicant_id UUID;
BEGIN
    -- Get job title
    SELECT j.title INTO job_title
    FROM jobs j
    WHERE j.id = NEW.job_id;
    
    -- Get applicant ID - FIXED: Changed from NEW.user_id
    applicant_id := NEW.applicant_id;
    
    -- Send push notification via edge function (async call)
    PERFORM net.http_post(
        url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', current_setting('app.settings.api_external_url', true)
        ),
        body := jsonb_build_object(
            'action', 'send_push',
            'user_id', applicant_id,
            'title', 'Application Submitted',
            'message', 'Your application for ' || job_title || ' has been submitted successfully.',
            'action_url', 'https://jubwzelupbntbetpajqb.supabase.co/activity'
        )
    );
    
    RETURN NEW;
END;
$function$;

-- Recreate trigger for send_applicant_push_notification
DROP TRIGGER IF EXISTS send_applicant_push_notification_trigger ON public.job_applications;
CREATE TRIGGER send_applicant_push_notification_trigger
    AFTER INSERT ON public.job_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.send_applicant_push_notification();