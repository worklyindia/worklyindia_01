-- First add unique constraint on trigger_event
CREATE UNIQUE INDEX IF NOT EXISTS telegram_automation_rules_trigger_event_idx ON public.telegram_automation_rules(trigger_event);

-- Insert automation rules (without ON CONFLICT since these are new)
INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'User Signup OTP', 'Send OTP when user signs up', 'user_signup_otp_sent', t.id, true, 'job_seeker', '{"otp_code": "otp_code"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Signup OTP Code'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'user_signup_otp_sent');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'User Telegram Connected', 'Welcome when connected', 'user_telegram_connected', t.id, true, 'job_seeker', '{"user_name": "full_name"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Profile Telegram Verify'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'user_telegram_connected');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Application Submitted', 'Notify when submitted', 'application_submitted', t.id, true, 'job_seeker', '{"user_name": "applicant_name", "job_title": "job_title", "company_name": "company_name"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Application Submitted'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'application_submitted');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Application Viewed', 'Notify when viewed', 'application_viewed', t.id, true, 'job_seeker', '{"user_name": "applicant_name", "company_name": "company_name", "job_title": "job_title"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Application Viewed'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'application_viewed');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Application Shortlisted', 'Notify when shortlisted', 'application_shortlisted', t.id, true, 'job_seeker', '{"user_name": "applicant_name", "company_name": "company_name"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Application Shortlisted'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'application_shortlisted');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Application Rejected', 'Notify when rejected', 'application_rejected', t.id, true, 'job_seeker', '{"user_name": "applicant_name", "job_title": "job_title"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Application Rejected'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'application_rejected');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Interview Scheduled', 'Notify when scheduled', 'interview_scheduled', t.id, true, 'job_seeker', '{"user_name": "applicant_name", "job_title": "job_title", "company_name": "company_name"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Interview Scheduled'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'interview_scheduled');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Interview Reminder', 'Send reminder', 'interview_reminder', t.id, true, 'job_seeker', '{"user_name": "applicant_name", "job_title": "job_title"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Interview Reminder'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'interview_reminder');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'User Payment Success', 'Payment confirmation', 'user_payment_success', t.id, true, 'job_seeker', '{"user_name": "full_name", "amount": "amount"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'User Payment Successful'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'user_payment_success');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Job Recommendation', 'Job match notification', 'job_recommendation', t.id, true, 'job_seeker', '{"user_name": "full_name", "job_title": "job_title"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'New Job Match'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'job_recommendation');

-- Employer rules
INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Employer Signup OTP', 'Send OTP', 'employer_signup_otp_sent', t.id, true, 'employer', '{"otp_code": "otp_code"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Company Signup OTP'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'employer_signup_otp_sent');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Employer Telegram Connected', 'Welcome', 'employer_telegram_connected', t.id, true, 'employer', '{"company_name": "company_name"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Company Telegram Verify'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'employer_telegram_connected');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Job Posted', 'Confirm posting', 'job_posted', t.id, true, 'employer', '{"company_name": "company_name", "job_title": "job_title"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Job Posted Successfully'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'job_posted');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'New Application Received', 'Notify employer', 'new_application_received', t.id, true, 'employer', '{"company_name": "company_name", "job_title": "job_title", "applicant_name": "applicant_name"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'New Application Received'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'new_application_received');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Employer Payment Success', 'Payment confirmation', 'employer_payment_success', t.id, true, 'employer', '{"company_name": "company_name", "amount": "amount"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Employer Payment Successful'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'employer_payment_success');

INSERT INTO public.telegram_automation_rules (name, description, trigger_event, template_id, is_active, target_user_type, variable_mapping, created_by)
SELECT 'Low Balance Alert', 'Alert low balance', 'employer_low_balance', t.id, true, 'employer', '{"company_name": "company_name", "current_balance": "points_balance"}'::jsonb, '5e9cf05e-89c1-474a-9071-91fd05956036'
FROM public.telegram_message_templates t WHERE t.name = 'Low Balance Alert'
AND NOT EXISTS (SELECT 1 FROM public.telegram_automation_rules WHERE trigger_event = 'employer_low_balance');