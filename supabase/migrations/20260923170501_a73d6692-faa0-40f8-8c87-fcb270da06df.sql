INSERT INTO public.app_settings (setting_key, setting_value)
SELECT k, COALESCE((SELECT setting_value FROM public.app_settings WHERE setting_key='phone_verify_enabled'),'false')
FROM unnest(ARRAY['phone_verify_jobseeker_signup','phone_verify_employer_signup','phone_verify_ai_signup','phone_verify_jobseeker_profile','phone_verify_employer_profile']) AS k
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings s WHERE s.setting_key = k);