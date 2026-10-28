-- Fix AUTH template variable_mapping to use both body_1 and button_1 for OTP
UPDATE whatsapp_automation_rules
SET variable_mapping = '{"body_1": "otp", "button_1": "otp"}'::jsonb
WHERE trigger_event IN ('user_signup_otp', 'user_profile_whatsapp_verify', 'company_signup_otp', 'company_profile_whatsapp_verify')
AND (variable_mapping IS NULL OR NOT (variable_mapping ? 'button_1'));

-- Update application_shortlisted with proper 3-variable mapping
UPDATE whatsapp_automation_rules
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event = 'application_shortlisted'
AND (variable_mapping IS NULL OR variable_mapping = '{}'::jsonb OR NOT (variable_mapping ? 'body_3'));