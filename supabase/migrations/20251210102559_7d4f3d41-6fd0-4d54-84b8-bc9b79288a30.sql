-- Fix existing OTP trigger variable_mapping to include button_1 for authentication templates
UPDATE whatsapp_automation_rules
SET variable_mapping = '{"body_1": "otp", "button_1": "otp"}'::jsonb
WHERE trigger_event IN ('user_signup_otp', 'user_profile_whatsapp_verify');

-- Update application_shortlisted with proper mapping
UPDATE whatsapp_automation_rules
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event = 'application_shortlisted';