-- Add RLS policy to allow employers to delete interviews for their jobs
CREATE POLICY "Employers can delete interviews for their jobs"
ON interviews
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    JOIN companies c ON j.company_id = c.id
    WHERE j.id = interviews.job_id
    AND c.user_id = auth.uid()
  )
);