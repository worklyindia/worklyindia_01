-- Fix critical security issue: Remove overly permissive "Hybrid interview viewing policy" 
-- that exposes ALL interviews publicly with "OR true" clause

-- Drop the dangerous public policy
DROP POLICY IF EXISTS "Hybrid interview viewing policy" ON public.interviews;

-- Create proper applicant access policy
CREATE POLICY "Applicants can view their own interviews"
  ON public.interviews
  FOR SELECT
  USING (auth.uid() = applicant_id);

-- Add comment explaining the fix
COMMENT ON POLICY "Applicants can view their own interviews" ON public.interviews IS 
'Security fix: Allow applicants to view only their own interviews. Employer access is handled by separate policy.';