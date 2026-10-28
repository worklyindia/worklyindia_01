-- Create table for WhatsApp OTP verifications
CREATE TABLE IF NOT EXISTS public.whatsapp_otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'verification',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_otp_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can verify OTP" ON public.whatsapp_otp_verifications
  FOR SELECT USING (true);

CREATE POLICY "Service role can insert OTP" ON public.whatsapp_otp_verifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update OTP" ON public.whatsapp_otp_verifications
  FOR UPDATE USING (true);

-- Create index for fast lookups
CREATE INDEX idx_whatsapp_otp_phone_purpose ON public.whatsapp_otp_verifications(phone, purpose);
CREATE INDEX idx_whatsapp_otp_expires ON public.whatsapp_otp_verifications(expires_at);

-- Update variable_mapping for existing automation rules
UPDATE public.whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "button_1": "otp"}'::jsonb
WHERE trigger_event = 'user_profile_whatsapp_verify';

UPDATE public.whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "button_1": "otp"}'::jsonb
WHERE trigger_event = 'user_signup_otp';

UPDATE public.whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event = 'application_shortlisted';

UPDATE public.whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event = 'application_submitted';

UPDATE public.whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "company_name"}'::jsonb
WHERE trigger_event = 'application_rejected';

UPDATE public.whatsapp_automation_rules 
SET variable_mapping = '{"body_1": "name", "body_2": "job_title", "body_3": "date", "body_4": "time", "body_5": "mode"}'::jsonb
WHERE trigger_event = 'interview_scheduled';