-- Phase 1: Fix problematic database functions
-- Remove the problematic trigger_trending_update function and replace with safe version
DROP FUNCTION IF EXISTS public.trigger_trending_update();

CREATE OR REPLACE FUNCTION public.trigger_trending_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Simple version without HTTP calls - just update trending scores directly
  PERFORM update_all_trending_scores();
END;
$$;

-- Phase 2: Fix RLS policies for jobs table
DROP POLICY IF EXISTS "Anyone can view public jobs" ON public.jobs;
DROP POLICY IF EXISTS "Jobs are publicly viewable" ON public.jobs;

-- Create comprehensive RLS policy for jobs viewing
CREATE POLICY "Public jobs are viewable by everyone"
ON public.jobs
FOR SELECT
USING (
  status = 'active' 
  AND visibility = 'public'
  AND EXISTS (
    SELECT 1 FROM public.companies c 
    WHERE c.id = jobs.company_id 
    AND c.account_status = 'active'
  )
);

-- Allow job owners to view all their jobs
CREATE POLICY "Job owners can view their jobs"
ON public.jobs  
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = jobs.company_id 
    AND c.user_id = auth.uid()
  )
);

-- Phase 3: Fix RLS policies for job_applications table
DROP POLICY IF EXISTS "Users can view their own applications" ON public.job_applications;

-- Allow users to view their own applications with proper job access
CREATE POLICY "Users can view their own applications with job details"
ON public.job_applications
FOR SELECT
USING (
  auth.uid() = user_id
);

-- Allow employers to view applications for their jobs
CREATE POLICY "Employers can view applications for their jobs"  
ON public.job_applications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.companies c ON j.company_id = c.id
    WHERE j.id = job_applications.job_id 
    AND c.user_id = auth.uid()
  )
);

-- Phase 4: Fix RLS policies for job_favorites table  
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.job_favorites;

-- Allow users to view their favorites
CREATE POLICY "Users can view their own favorites"
ON public.job_favorites
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert favorites
CREATE POLICY "Users can add favorites"
ON public.job_favorites
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete favorites  
CREATE POLICY "Users can remove favorites"
ON public.job_favorites
FOR DELETE
USING (auth.uid() = user_id);

-- Phase 5: Create function to safely get job details for applications
CREATE OR REPLACE FUNCTION public.get_job_for_application(p_job_id uuid)
RETURNS TABLE(
  id uuid,
  title text,
  company_name text,
  location text,
  status text,
  company_id uuid
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
    COALESCE(c.company_name, 'Unknown Company') as company_name,
    COALESCE(j.location, c.location, 'Unknown Location') as location,
    j.status,
    j.company_id
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE j.id = p_job_id
  AND j.status = 'active'
  AND c.account_status = 'active';
END;
$$;