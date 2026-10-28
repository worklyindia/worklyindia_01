-- Add optional API-specific structured data fields to job_applications table
-- These will store data sent through API, separate from profile data

ALTER TABLE job_applications 
ADD COLUMN IF NOT EXISTS api_social_links JSONB,
ADD COLUMN IF NOT EXISTS api_certifications JSONB,
ADD COLUMN IF NOT EXISTS api_professional_experiences JSONB,
ADD COLUMN IF NOT EXISTS api_education_entries JSONB,
ADD COLUMN IF NOT EXISTS application_source TEXT DEFAULT 'website' CHECK (application_source IN ('api', 'website'));

-- Add index for faster filtering by application source
CREATE INDEX IF NOT EXISTS idx_job_applications_source ON job_applications(application_source);

-- Add comments for documentation
COMMENT ON COLUMN job_applications.api_social_links IS 'Social media links sent via API: {instagram, facebook, youtube, linkedin}';
COMMENT ON COLUMN job_applications.api_certifications IS 'Array of certifications sent via API';
COMMENT ON COLUMN job_applications.api_professional_experiences IS 'Array of work experiences sent via API';
COMMENT ON COLUMN job_applications.api_education_entries IS 'Array of education entries sent via API';
COMMENT ON COLUMN job_applications.application_source IS 'Source of application: api or website';