DELETE FROM public.push_lifecycle_templates
WHERE event_type = 'login_otp';

DELETE FROM public.telegram_lifecycle_templates
WHERE event_type = 'login_otp';