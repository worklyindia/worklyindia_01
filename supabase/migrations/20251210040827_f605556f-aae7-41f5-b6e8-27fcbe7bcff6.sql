-- Add target_user_type column to whatsapp_automation_rules
ALTER TABLE public.whatsapp_automation_rules 
ADD COLUMN IF NOT EXISTS target_user_type text DEFAULT 'both' CHECK (target_user_type IN ('website_user', 'employer', 'both'));

-- Update existing rules with appropriate target_user_type based on trigger_event
UPDATE public.whatsapp_automation_rules 
SET target_user_type = CASE 
  WHEN trigger_event IN ('application_submitted', 'application_viewed', 'application_shortlisted', 'application_rejected', 'interview_scheduled', 'interview_reminder', 'offer_received', 'payment_received', 'profile_completed') THEN 'website_user'
  WHEN trigger_event IN ('new_application_received', 'job_posted', 'job_expiring', 'company_signup_otp', 'company_profile_whatsapp_verify') THEN 'employer'
  ELSE 'both'
END
WHERE target_user_type IS NULL OR target_user_type = 'both';

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_automation_rules.target_user_type IS 'Target user type: website_user (job seekers), employer (companies), or both';