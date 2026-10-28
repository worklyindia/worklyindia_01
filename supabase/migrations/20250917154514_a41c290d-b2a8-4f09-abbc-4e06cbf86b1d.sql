-- Fix push notification triggers by removing problematic JSON operations
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
    
    -- Get applicant ID
    applicant_id := NEW.user_id;
    
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

-- Fix payment notification trigger 
CREATE OR REPLACE FUNCTION public.send_payment_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    payment_user_id UUID;
    points_added INTEGER;
BEGIN
    -- Only trigger on status change to success
    IF OLD.status != 'success' AND NEW.status = 'success' THEN
        payment_user_id := NEW.user_id;
        points_added := NEW.points;
        
        -- Send push notification via edge function (async call)
        PERFORM net.http_post(
            url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'apikey', current_setting('app.settings.api_external_url', true)
            ),
            body := jsonb_build_object(
                'action', 'send_push',
                'user_id', payment_user_id,
                'title', '🎉 Payment Successful!',
                'message', 'Great! ' || points_added || ' points have been added to your wallet.',
                'action_url', 'https://jubwzelupbntbetpajqb.supabase.co/wallet'
            )
        );
    END IF;
    
    RETURN NEW;
END;
$function$;