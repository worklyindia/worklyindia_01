-- Fix remaining database functions with problematic JSON operators

-- Fix create_employer_job_application_notification_with_push function
CREATE OR REPLACE FUNCTION public.create_employer_job_application_notification_with_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    job_title TEXT;
    company_name TEXT;
    employer_id UUID;
    applicant_name TEXT;
    notification_id UUID;
BEGIN
    -- Get job and company details
    SELECT j.title, c.company_name, c.user_id 
    INTO job_title, company_name, employer_id
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.id = NEW.job_id;
    
    -- Get applicant name
    SELECT COALESCE(p.full_name, 'Someone') 
    INTO applicant_name
    FROM profiles p
    WHERE p.user_id = NEW.user_id;
    
    -- Create notification for employer
    INSERT INTO employer_notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        employer_id,
        'New Job Application',
        applicant_name || ' applied for your ' || job_title || ' position',
        'application',
        '/employer-portal/job-analytics/' || NEW.job_id,
        jsonb_build_object(
            'job_id', NEW.job_id,
            'application_id', NEW.id,
            'applicant_id', NEW.user_id,
            'job_title', job_title
        )
    ) RETURNING id INTO notification_id;
    
    -- Send push notification (async call to edge function)
    PERFORM net.http_post(
        url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', current_setting('app.settings.api_external_url', true)
        ),
        body := jsonb_build_object(
            'action', 'send_push',
            'user_id', employer_id,
            'title', 'New Job Application',
            'message', applicant_name || ' applied for your ' || job_title || ' position',
            'action_url', 'https://jubwzelupbntbetpajqb.supabase.co/employer-portal/job-analytics/' || NEW.job_id
        )
    );
    
    RETURN NEW;
END;
$function$;

-- Fix create_employer_interview_notification_with_push function
CREATE OR REPLACE FUNCTION public.create_employer_interview_notification_with_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    job_title TEXT;
    employer_id UUID;
    applicant_name TEXT;
    notification_id UUID;
BEGIN
    -- Get job details and employer
    SELECT j.title, c.user_id 
    INTO job_title, employer_id
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.id = NEW.job_id;
    
    -- Get applicant name
    SELECT COALESCE(p.full_name, 'Applicant') 
    INTO applicant_name
    FROM profiles p
    WHERE p.user_id = NEW.applicant_id;
    
    -- Create notification for employer
    INSERT INTO employer_notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        employer_id,
        'Interview Scheduled',
        'Interview scheduled with ' || applicant_name || ' for ' || job_title,
        'interview',
        '/employer-portal/interviews',
        jsonb_build_object(
            'job_id', NEW.job_id,
            'interview_id', NEW.id,
            'applicant_id', NEW.applicant_id,
            'scheduled_at', NEW.scheduled_at
        )
    ) RETURNING id INTO notification_id;
    
    -- Send push notification (async call to edge function)
    PERFORM net.http_post(
        url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', current_setting('app.settings.api_external_url', true)
        ),
        body := jsonb_build_object(
            'action', 'send_push',
            'user_id', employer_id,
            'title', 'Interview Scheduled',
            'message', 'Interview scheduled with ' || applicant_name || ' for ' || job_title,
            'action_url', 'https://jubwzelupbntbetpajqb.supabase.co/employer-portal/interviews'
        )
    );
    
    RETURN NEW;
END;
$function$;