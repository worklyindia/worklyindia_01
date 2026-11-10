-- Update the jobs RLS policy to properly handle banned employers and job posting visibility
DROP POLICY IF EXISTS "Jobs can be viewed by everyone" ON public.jobs;

CREATE POLICY "Jobs can be viewed by everyone" 
ON public.jobs 
FOR SELECT 
USING (
  -- Jobs are visible if:
  (
    status = 'active' 
    AND visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM public.companies c 
      WHERE c.id = jobs.company_id 
      AND c.account_status = 'active'  -- Company is not banned
      AND EXISTS (
        SELECT 1 FROM public.employer_settings es 
        WHERE es.user_id = c.user_id 
        AND es.job_posting_visibility = true  -- Job posting is enabled
      )
    )
  )
  OR 
  -- Company owners can always see their own jobs
  EXISTS (
    SELECT 1 FROM public.companies c 
    WHERE c.id = jobs.company_id 
    AND c.user_id = auth.uid()
  )
);