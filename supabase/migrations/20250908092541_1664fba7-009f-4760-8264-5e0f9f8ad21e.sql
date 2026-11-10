-- Create function to clean old notifications (older than 24 hours)
CREATE OR REPLACE FUNCTION public.clean_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER := 0;
  employer_deleted_count INTEGER := 0;
  total_deleted INTEGER := 0;
BEGIN
  -- Delete old notifications from notifications table
  DELETE FROM public.notifications 
  WHERE created_at < (NOW() - INTERVAL '24 hours')
  AND (metadata->>'preserve' IS NULL OR metadata->>'preserve' != 'true');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete old notifications from employer_notifications table
  DELETE FROM public.employer_notifications 
  WHERE created_at < (NOW() - INTERVAL '24 hours')
  AND (metadata->>'preserve' IS NULL OR metadata->>'preserve' != 'true');
  
  GET DIAGNOSTICS employer_deleted_count = ROW_COUNT;
  
  total_deleted := deleted_count + employer_deleted_count;
  
  -- Log the cleanup activity
  RAISE NOTICE 'Cleaned % notifications (% regular, % employer)', total_deleted, deleted_count, employer_deleted_count;
  
  RETURN total_deleted;
END;
$function$;

-- Create cron job to run cleanup every hour
SELECT cron.schedule(
  'clean-old-notifications-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT public.clean_old_notifications();
  $$
);

-- Also create a manual trigger function for immediate cleanup
CREATE OR REPLACE FUNCTION public.trigger_notification_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- This can be called manually to trigger notification cleanup immediately
  PERFORM public.clean_old_notifications();
END;
$function$;