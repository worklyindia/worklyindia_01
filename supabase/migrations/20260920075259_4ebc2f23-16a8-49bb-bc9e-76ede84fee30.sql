ALTER TABLE public.user_settings DROP CONSTRAINT IF EXISTS user_settings_two_factor_method_check;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_two_factor_method_check CHECK (two_factor_method IS NULL OR two_factor_method = ANY (ARRAY['telegram','google_authenticator','passkey','pattern_lock','push_otp','email_otp']));

ALTER TABLE public.employer_settings DROP CONSTRAINT IF EXISTS employer_settings_two_factor_method_check;
ALTER TABLE public.employer_settings ADD CONSTRAINT employer_settings_two_factor_method_check CHECK (two_factor_method IS NULL OR two_factor_method = ANY (ARRAY['telegram','google_authenticator','passkey','pattern_lock','push_otp','email_otp']));