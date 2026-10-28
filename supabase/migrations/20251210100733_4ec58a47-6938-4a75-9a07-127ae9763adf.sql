-- Fix variable_mapping for OTP templates
-- For authentication templates: body_1 = OTP value (the verification code)
-- button_1 = OTP value (for copy button)

-- Fix user_signup_otp mapping
UPDATE whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "otp", "button_1": "otp"}'::jsonb
WHERE trigger_event = 'user_signup_otp';

-- Fix user_profile_whatsapp_verify mapping
UPDATE whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "otp", "button_1": "otp"}'::jsonb
WHERE trigger_event = 'user_profile_whatsapp_verify';

-- Fix application_shortlisted mapping (body_1=name, body_2=job_title, body_3=company_name)
UPDATE whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event = 'application_shortlisted';

-- Fix application_submitted mapping
UPDATE whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event = 'application_submitted';

-- Fix application_rejected mapping
UPDATE whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event = 'application_rejected';

-- Fix interview_scheduled mapping (body_1=name, body_2=job_title, body_3=company_name, body_4=date, body_5=time, body_6=mode)
UPDATE whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name", "body_4": "date", "body_5": "time", "body_6": "mode"}'::jsonb
WHERE trigger_event = 'interview_scheduled';

-- Log the updates for verification
DO $$
DECLARE
  rule RECORD;
BEGIN
  FOR rule IN SELECT trigger_event, variable_mapping FROM whatsapp_automation_rules LOOP
    RAISE NOTICE 'Rule % has mapping: %', rule.trigger_event, rule.variable_mapping;
  END LOOP;
END $$;