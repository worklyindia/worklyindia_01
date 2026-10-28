-- Add API company detail fields to jobs table
ALTER TABLE public.jobs
ADD COLUMN api_company_name TEXT,
ADD COLUMN api_industry TEXT,
ADD COLUMN api_organisation_size TEXT,
ADD COLUMN api_company_description TEXT,
ADD COLUMN api_instagram_link TEXT,
ADD COLUMN api_facebook_link TEXT,
ADD COLUMN api_linkedin_link TEXT,
ADD COLUMN api_youtube_link TEXT;

-- Add comment
COMMENT ON COLUMN public.jobs.api_company_name IS 'Company name provided via API (overrides company profile)';
COMMENT ON COLUMN public.jobs.api_industry IS 'Industry provided via API';
COMMENT ON COLUMN public.jobs.api_organisation_size IS 'Organization size provided via API';
COMMENT ON COLUMN public.jobs.api_company_description IS 'Company description provided via API';
COMMENT ON COLUMN public.jobs.api_instagram_link IS 'Instagram link provided via API';
COMMENT ON COLUMN public.jobs.api_facebook_link IS 'Facebook link provided via API';
COMMENT ON COLUMN public.jobs.api_linkedin_link IS 'LinkedIn link provided via API';
COMMENT ON COLUMN public.jobs.api_youtube_link IS 'YouTube link provided via API';