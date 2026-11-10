-- Drop all triggers that depend on the function
DROP TRIGGER IF EXISTS trg_check_duplicate_application ON public.job_applications;
DROP TRIGGER IF EXISTS prevent_duplicate_applications ON public.job_applications;
DROP FUNCTION IF EXISTS public.check_duplicate_application() CASCADE;

-- Fix job_applications table schema
ALTER TABLE public.job_applications 
RENAME COLUMN user_id TO applicant_id;

-- Add employer_id column (nullable first)
ALTER TABLE public.job_applications 
ADD COLUMN employer_id UUID;

-- Update existing records to set employer_id from companies (only where valid)
UPDATE public.job_applications ja
SET employer_id = c.user_id
FROM public.jobs j
JOIN public.companies c ON j.company_id = c.id
WHERE ja.job_id = j.id
  AND c.user_id IN (SELECT id FROM public.profiles);

-- Delete orphaned applications where employer doesn't exist in profiles
DELETE FROM public.job_applications
WHERE employer_id IS NULL;

-- Now add the foreign key constraint and make it NOT NULL
ALTER TABLE public.job_applications 
ADD CONSTRAINT job_applications_employer_id_fkey 
FOREIGN KEY (employer_id) REFERENCES public.profiles(id);

ALTER TABLE public.job_applications 
ALTER COLUMN employer_id SET NOT NULL;

-- Recreate the duplicate check trigger with correct column name
CREATE OR REPLACE FUNCTION public.check_duplicate_application()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM job_applications 
    WHERE applicant_id = NEW.applicant_id 
    AND job_id = NEW.job_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'You have already applied to this job';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER prevent_duplicate_applications
BEFORE INSERT OR UPDATE ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.check_duplicate_application();

-- Add missing columns to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'INR';

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS responsibilities TEXT[];

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS remote_allowed BOOLEAN DEFAULT false;

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS visa_sponsorship BOOLEAN DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_id ON public.job_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_employer_id ON public.job_applications(employer_id);