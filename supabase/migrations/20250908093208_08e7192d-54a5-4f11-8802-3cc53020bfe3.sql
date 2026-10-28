-- Create function to get unread applicant notifications count for an employer
CREATE OR REPLACE FUNCTION public.get_employer_applicant_notification_count(p_user_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    notification_count INTEGER;
    target_user_id UUID;
BEGIN
    target_user_id := COALESCE(p_user_id, auth.uid());
    
    IF target_user_id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Count unread application notifications for this employer
    SELECT COUNT(*)::INTEGER INTO notification_count
    FROM employer_notifications
    WHERE user_id = target_user_id 
    AND type = 'application' 
    AND is_read = FALSE;
    
    RETURN COALESCE(notification_count, 0);
END;
$function$;

-- Create function to mark all applicant notifications as read for an employer
CREATE OR REPLACE FUNCTION public.mark_employer_applicant_notifications_read(p_user_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    target_user_id UUID;
BEGIN
    target_user_id := COALESCE(p_user_id, auth.uid());
    
    IF target_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Mark all application notifications as read for this employer
    UPDATE employer_notifications
    SET is_read = true, updated_at = now()
    WHERE user_id = target_user_id 
    AND type = 'application' 
    AND is_read = FALSE;
    
    RETURN TRUE;
END;
$function$;