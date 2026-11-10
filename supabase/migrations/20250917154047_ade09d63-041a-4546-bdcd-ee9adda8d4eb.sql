-- Create push notification trigger for job applicants
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
            'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'
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

-- Create trigger for job applications to send push notifications to applicants
DROP TRIGGER IF EXISTS trigger_send_applicant_push_notification ON job_applications;
CREATE TRIGGER trigger_send_applicant_push_notification
    AFTER INSERT ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.send_applicant_push_notification();

-- Create push notification trigger for payment success
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
                'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'
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

-- Create trigger for transactions to send push notifications for payments
DROP TRIGGER IF EXISTS trigger_send_payment_push_notification ON transactions;
CREATE TRIGGER trigger_send_payment_push_notification
    AFTER UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.send_payment_push_notification();