-- Ensure job_applications table has all the necessary columns and indexes
DO $$ 
BEGIN
    -- Add resume_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='job_applications' AND column_name='resume_url') THEN
        ALTER TABLE job_applications ADD COLUMN resume_url TEXT;
    END IF;
    
    -- Add cover_letter column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='job_applications' AND column_name='cover_letter') THEN
        ALTER TABLE job_applications ADD COLUMN cover_letter TEXT;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_applied_at ON job_applications(applied_at DESC);

-- Create a function to prevent duplicate applications
CREATE OR REPLACE FUNCTION check_duplicate_application()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user has already applied for this job
    IF EXISTS (
        SELECT 1 FROM job_applications 
        WHERE user_id = NEW.user_id 
        AND job_id = NEW.job_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
        RAISE EXCEPTION 'User has already applied for this job';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent duplicate applications
DROP TRIGGER IF EXISTS prevent_duplicate_applications ON job_applications;
CREATE TRIGGER prevent_duplicate_applications
    BEFORE INSERT OR UPDATE ON job_applications
    FOR EACH ROW
    EXECUTE FUNCTION check_duplicate_application();