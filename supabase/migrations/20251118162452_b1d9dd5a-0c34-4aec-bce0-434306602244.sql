-- Fix: Allow guest applications by permitting NULL applicant_id
-- This solves the "Failed to submit application" error for guest users

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can create their own applications" ON public.job_applications;

-- Create new policy that allows both authenticated and guest applications
CREATE POLICY "Users can create their own applications"
ON public.job_applications 
FOR INSERT
TO public
WITH CHECK (
  -- Authenticated users: applicant_id must match their auth.uid()
  (auth.uid() = applicant_id) 
  OR 
  -- Guest users: both auth.uid() and applicant_id are NULL
  (auth.uid() IS NULL AND applicant_id IS NULL)
);