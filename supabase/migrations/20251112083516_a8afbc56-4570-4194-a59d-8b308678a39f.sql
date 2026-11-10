-- Add API-specific basic profile data columns to job_applications table
-- These columns store data submitted via API without updating the user's profile

ALTER TABLE public.job_applications 
ADD COLUMN IF NOT EXISTS api_full_name text,
ADD COLUMN IF NOT EXISTS api_email text,
ADD COLUMN IF NOT EXISTS api_phone text,
ADD COLUMN IF NOT EXISTS api_whatsapp_number text,
ADD COLUMN IF NOT EXISTS api_location text,
ADD COLUMN IF NOT EXISTS api_skills text[],
ADD COLUMN IF NOT EXISTS api_bio text,
ADD COLUMN IF NOT EXISTS api_current_position text,
ADD COLUMN IF NOT EXISTS api_company text,
ADD COLUMN IF NOT EXISTS api_experience_years integer,
ADD COLUMN IF NOT EXISTS api_languages text[];

-- Add comments for documentation
COMMENT ON COLUMN public.job_applications.api_full_name IS 'Full name submitted via API (not stored in profile)';
COMMENT ON COLUMN public.job_applications.api_email IS 'Email submitted via API (may differ from auth email)';
COMMENT ON COLUMN public.job_applications.api_phone IS 'Phone number submitted via API';
COMMENT ON COLUMN public.job_applications.api_whatsapp_number IS 'WhatsApp number submitted via API';
COMMENT ON COLUMN public.job_applications.api_location IS 'Location submitted via API';
COMMENT ON COLUMN public.job_applications.api_skills IS 'Skills array submitted via API';
COMMENT ON COLUMN public.job_applications.api_bio IS 'Bio/summary submitted via API';
COMMENT ON COLUMN public.job_applications.api_current_position IS 'Current position submitted via API';
COMMENT ON COLUMN public.job_applications.api_company IS 'Current company submitted via API';
COMMENT ON COLUMN public.job_applications.api_experience_years IS 'Years of experience submitted via API';
COMMENT ON COLUMN public.job_applications.api_languages IS 'Languages array submitted via API';