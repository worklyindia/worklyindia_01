-- Create function to delete expired jobs (instead of just marking them)
CREATE OR REPLACE FUNCTION public.delete_expired_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  -- Delete jobs that have been expired for more than 7 days
  DELETE FROM public.jobs
  WHERE status = 'expired' 
    AND expires_at < (now() - interval '7 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Create table to track when employer views applicants for each job
CREATE TABLE IF NOT EXISTS public.job_applicant_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  employer_id uuid NOT NULL,
  last_viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  last_applicant_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(job_id, employer_id)
);

-- Enable RLS
ALTER TABLE public.job_applicant_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Employers can manage their own applicant views"
ON public.job_applicant_views
FOR ALL
USING (auth.uid() = employer_id)
WITH CHECK (auth.uid() = employer_id);

-- Create function to get unread applicant counts per job
CREATE OR REPLACE FUNCTION public.get_unread_applicants_per_job(p_employer_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  job_id uuid,
  total_applicants bigint,
  unread_count bigint,
  last_viewed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id as job_id,
    COUNT(DISTINCT ja.id) as total_applicants,
    COUNT(DISTINCT CASE 
      WHEN jav.last_viewed_at IS NULL OR ja.applied_at > jav.last_viewed_at 
      THEN ja.id 
      ELSE NULL 
    END) as unread_count,
    jav.last_viewed_at
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  LEFT JOIN public.job_applications ja ON ja.job_id = j.id
  LEFT JOIN public.job_applicant_views jav ON jav.job_id = j.id AND jav.employer_id = p_employer_id
  WHERE c.user_id = p_employer_id
  GROUP BY j.id, jav.last_viewed_at;
END;
$$;

-- Create function to mark job applicants as viewed
CREATE OR REPLACE FUNCTION public.mark_job_applicants_viewed(p_job_id uuid, p_employer_id uuid DEFAULT auth.uid())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count integer;
BEGIN
  -- Get current applicant count
  SELECT COUNT(*) INTO current_count
  FROM public.job_applications
  WHERE job_id = p_job_id;
  
  -- Insert or update the view record
  INSERT INTO public.job_applicant_views (job_id, employer_id, last_viewed_at, last_applicant_count)
  VALUES (p_job_id, p_employer_id, now(), current_count)
  ON CONFLICT (job_id, employer_id)
  DO UPDATE SET
    last_viewed_at = now(),
    last_applicant_count = current_count,
    updated_at = now();
END;
$$;