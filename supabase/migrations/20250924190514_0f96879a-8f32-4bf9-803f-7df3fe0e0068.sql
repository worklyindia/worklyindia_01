-- Create function to get jobs for a specific employer (user_id)
CREATE OR REPLACE FUNCTION public.get_employer_jobs(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  title text,
  location text,
  job_type text,
  salary_range text,
  status text,
  category text,
  created_at timestamp with time zone,
  expires_at timestamp with time zone,
  views_count integer,
  applications_count integer,
  is_boosted boolean,
  boost_level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.location,
    j.job_type,
    j.salary_range,
    j.status,
    j.category,
    j.created_at,
    j.expires_at,
    COALESCE(j.views_count, 0) as views_count,
    COALESCE(j.applications_count, 0) as applications_count,
    COALESCE(j.is_boosted, false) as is_boosted,
    COALESCE(j.boost_level, 0) as boost_level
  FROM public.jobs j
  JOIN public.companies c ON j.company_id = c.id
  WHERE c.user_id = p_user_id
    AND j.status != 'deleted'  -- Don't show deleted jobs
  ORDER BY j.created_at DESC;
END;
$$;