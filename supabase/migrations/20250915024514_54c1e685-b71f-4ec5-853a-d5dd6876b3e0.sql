-- Create function to automatically send push notifications for regular notifications
CREATE OR REPLACE FUNCTION public.send_push_notification_for_notification()
RETURNS TRIGGER AS $$
DECLARE
  user_preferences RECORD;
  should_send_push BOOLEAN := false;
BEGIN
  -- Get user's push notification preferences
  SELECT * INTO user_preferences 
  FROM public.push_notification_preferences 
  WHERE user_id = NEW.user_id;

  -- Check if user wants push notifications for this type
  IF user_preferences IS NOT NULL THEN
    CASE NEW.type
      WHEN 'application' THEN should_send_push := user_preferences.job_applications;
      WHEN 'interview' THEN should_send_push := user_preferences.interview_reminders;
      WHEN 'job_alert' THEN should_send_push := user_preferences.job_alerts;
      WHEN 'system' THEN should_send_push := user_preferences.system_notifications;
      ELSE should_send_push := true;
    END CASE;
  ELSE
    -- Default to true if no preferences set
    should_send_push := true;
  END IF;

  -- Send push notification if user wants it
  IF should_send_push THEN
    -- Call our edge function to send the push notification
    PERFORM net.http_post(
      url := 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1/send-notification',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key', true) || '"}',
      body := json_build_object(
        'action', 'send_push',
        'user_id', NEW.user_id,
        'title', NEW.title,
        'message', NEW.message,
        'action_url', NEW.action_url
      )::text
    );
    
    -- Log the push notification attempt (use notification_id if available, or create log without it)
    INSERT INTO public.push_notification_logs (user_id, status)
    VALUES (NEW.user_id, 'sent');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically send push notifications for regular notifications
DROP TRIGGER IF EXISTS trigger_send_push_notification_regular ON public.notifications;
CREATE TRIGGER trigger_send_push_notification_regular
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_notification_for_notification();