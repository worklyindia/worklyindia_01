-- Allow employers to view indexing status for their company's jobs
CREATE POLICY "Employers can view indexing status for their jobs"
ON public.google_indexing_queue
FOR SELECT
TO authenticated
USING (
  job_id IN (
    SELECT id FROM public.jobs 
    WHERE company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = auth.uid()
    )
  )
);