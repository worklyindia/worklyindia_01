-- Fix OTP templates variable_mapping (remove button_1 as MSG91 auth templates may not need it)
UPDATE whatsapp_automation_rules
SET variable_mapping = '{"body_1": "otp"}'::jsonb
WHERE trigger_event IN ('user_signup_otp', 'user_profile_whatsapp_verify', 'company_signup_otp', 'company_profile_whatsapp_verify');

-- Fix shortlist congratulations variable_mapping
UPDATE whatsapp_automation_rules
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event = 'application_shortlisted';

-- Fix interview scheduled variable_mapping  
UPDATE whatsapp_automation_rules
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name", "body_4": "date", "body_5": "time", "body_6": "mode"}'::jsonb
WHERE trigger_event IN ('interview_scheduled', 'interview_reminder', 'employer_interview_scheduled', 'employer_interview_reminder');

-- Fix application related variable_mappings
UPDATE whatsapp_automation_rules
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event IN ('application_submitted', 'application_viewed');

UPDATE whatsapp_automation_rules
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name", "body_4": "reason"}'::jsonb
WHERE trigger_event = 'application_rejected';