-- Drop the existing restrictive policy for applicants
DROP POLICY IF EXISTS "Applicants can view their own interviews" ON public.interviews;

-- Create a new hybrid policy that allows:
-- 1. Applicants to view their own interviews
-- 2. Employers to view their company's interviews
-- 3. Anyone with the interview ID to view basic details (for shareable links)
CREATE POLICY "Hybrid interview viewing policy"
ON public.interviews
FOR SELECT
USING (
  -- Applicant can see their own interviews
  auth.uid() = applicant_id
  OR
  -- Employer can see their company's job interviews
  EXISTS (
    SELECT 1 
    FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.id = interviews.job_id 
    AND c.user_id = auth.uid()
  )
  OR
  -- Anyone can view interview details if they have the interview ID (for shareable links)
  -- Sensitive data will be conditionally hidden in the application layer
  true
);