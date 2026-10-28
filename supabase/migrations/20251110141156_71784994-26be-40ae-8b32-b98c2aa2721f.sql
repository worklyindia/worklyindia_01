-- ============================================================================
-- Fix job_applications Foreign Key Constraints
-- ============================================================================
-- Issue: applicant_id was incorrectly referencing auth.users.id
--        while employer_id correctly references profiles.id
-- Fix: Make both applicant_id and employer_id reference profiles.id
-- ============================================================================

-- Drop the incorrect foreign key constraint on applicant_id
ALTER TABLE public.job_applications 
DROP CONSTRAINT IF EXISTS job_applications_applicant_id_fkey;

ALTER TABLE public.job_applications 
DROP CONSTRAINT IF EXISTS job_applications_user_id_fkey;

-- Add the correct foreign key constraint for applicant_id pointing to profiles.id
ALTER TABLE public.job_applications 
ADD CONSTRAINT job_applications_applicant_id_fkey 
FOREIGN KEY (applicant_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Verify employer_id foreign key exists (should already be correct)
-- If it doesn't exist, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'job_applications_employer_id_fkey' 
    AND table_name = 'job_applications'
  ) THEN
    ALTER TABLE public.job_applications 
    ADD CONSTRAINT job_applications_employer_id_fkey 
    FOREIGN KEY (employer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_id 
ON public.job_applications(applicant_id);

CREATE INDEX IF NOT EXISTS idx_job_applications_employer_id 
ON public.job_applications(employer_id);

CREATE INDEX IF NOT EXISTS idx_job_applications_job_id 
ON public.job_applications(job_id);

-- Add a comment to document the fix
COMMENT ON CONSTRAINT job_applications_applicant_id_fkey ON public.job_applications 
IS 'Fixed: Now correctly references profiles.id instead of auth.users.id';