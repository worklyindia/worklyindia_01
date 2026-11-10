-- Drop the push notification trigger that's causing HTTP call failures
DROP TRIGGER IF EXISTS trigger_send_push_notification ON employer_notifications;

-- Also drop the function that makes the HTTP call
DROP FUNCTION IF EXISTS send_push_notification_for_employer_notification();

-- Drop the regular notifications push trigger too if it exists
DROP TRIGGER IF EXISTS trigger_send_push_notification_regular ON notifications;
DROP FUNCTION IF EXISTS send_push_notification_for_notification();