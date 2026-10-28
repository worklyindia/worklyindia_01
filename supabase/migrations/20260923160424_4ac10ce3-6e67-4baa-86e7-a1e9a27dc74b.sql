CREATE TABLE public.signup_email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  audience text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.signup_email_otps TO service_role;
ALTER TABLE public.signup_email_otps ENABLE ROW LEVEL SECURITY;
CREATE INDEX signup_email_otps_email_idx ON public.signup_email_otps (lower(email), created_at DESC);

INSERT INTO public.app_settings (setting_key, setting_value, description)
SELECT k, 'false', d FROM (VALUES
  ('signup_email_otp_jobseeker','Email OTP before Job Seeker account is created'),
  ('signup_email_otp_employer','Email OTP before Employer account is created'),
  ('signup_email_otp_ai','Email OTP before AI account is created')
) v(k,d)
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings s WHERE s.setting_key = v.k);