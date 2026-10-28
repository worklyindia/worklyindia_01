-- Allow anyone to view indexing status for PUBLIC jobs (used by employer dashboard when session is not present)
CREATE POLICY "Public can view indexing status for public jobs"
ON public.google_indexing_queue
FOR SELECT
TO public
USING (
  job_id IN (
    SELECT j.id
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    WHERE j.status = 'active'
      AND j.visibility = 'public'
      AND c.account_status = 'active'
  )
);