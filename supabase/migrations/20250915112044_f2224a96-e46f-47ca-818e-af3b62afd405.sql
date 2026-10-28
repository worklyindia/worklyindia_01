-- Add unique constraint to prevent duplicate job applications
ALTER TABLE job_applications ADD CONSTRAINT unique_user_job_application UNIQUE (user_id, job_id);