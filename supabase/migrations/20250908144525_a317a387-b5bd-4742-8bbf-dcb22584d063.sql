-- Create cleanup function with logging
CREATE OR REPLACE FUNCTION public.cleanup_interviews_with_logging()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    deleted_count INTEGER := 0;
    expired_count INTEGER := 0;
    cancelled_count INTEGER := 0;
BEGIN
    -- Delete completed interviews that have passed their end time by 1 hour
    DELETE FROM public.interviews 
    WHERE status = 'completed' 
    AND scheduled_end_at IS NOT NULL 
    AND scheduled_end_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Delete cancelled interviews older than 24 hours
    DELETE FROM public.interviews 
    WHERE status = 'cancelled' 
    AND created_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS cancelled_count = ROW_COUNT;
    
    deleted_count := expired_count + cancelled_count;
    
    -- Log the cleanup activity
    INSERT INTO public.interview_cleanup_logs (
        interviews_deleted, 
        expired_deleted, 
        cancelled_deleted
    ) VALUES (
        deleted_count,
        expired_count, 
        cancelled_count
    );
    
    RETURN deleted_count;
END;
$function$