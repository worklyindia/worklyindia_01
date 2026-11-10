-- Allow guest applications by making applicant_id nullable
-- This enables non-logged-in users to apply for jobs using the api_* fields

ALTER TABLE job_applications 
ALTER COLUMN applicant_id DROP NOT NULL;