-- Create security definer functions for accurate counting
CREATE OR REPLACE FUNCTION public.get_job_view_count(p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  view_count INTEGER := 0;
BEGIN
  -- Count unique views (by user_id or interaction id for anonymous)
  SELECT COUNT(DISTINCT COALESCE(user_id::text, id::text)) INTO view_count
  FROM public.job_interactions 
  WHERE job_id = p_job_id 
    AND interaction_type = 'view';
  
  RETURN COALESCE(view_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_job_application_count(p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_count INTEGER := 0;
BEGIN
  -- Count total applications for this job
  SELECT COUNT(*) INTO app_count
  FROM public.job_applications 
  WHERE job_id = p_job_id;
  
  RETURN COALESCE(app_count, 0);
END;
$$;

-- Add RLS policy to allow anyone to count interactions (for statistics)
DROP POLICY IF EXISTS "Anyone can count job interactions" ON public.job_interactions;
CREATE POLICY "Anyone can count job interactions"
ON public.job_interactions
FOR SELECT
USING (true);

-- Add RLS policy to allow anyone to count applications (for statistics)
DROP POLICY IF EXISTS "Anyone can count job applications" ON public.job_applications;
CREATE POLICY "Anyone can count job applications"
ON public.job_applications
FOR SELECT
USING (true);