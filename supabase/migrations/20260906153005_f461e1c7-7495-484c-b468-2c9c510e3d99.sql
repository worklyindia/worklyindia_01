UPDATE public.whatsapp_automation_rules
SET is_active = true, updated_at = now()
WHERE trigger_event IN (
  'user_signup_otp',
  'company_signup_otp',
  'user_profile_whatsapp_verify',
  'company_profile_whatsapp_verify'
);