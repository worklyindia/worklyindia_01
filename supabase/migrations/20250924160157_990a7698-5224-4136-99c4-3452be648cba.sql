-- Fix job visibility logic: job_posting_visibility should only affect NEW job posting, not existing job visibility

-- Drop the problematic policy that incorrectly hides existing jobs when job posting is paused
DROP POLICY IF EXISTS "Jobs can be viewed by everyone" ON public.jobs;

-- Drop the redundant policy
DROP POLICY IF EXISTS "Public jobs are viewable by everyone" ON public.jobs;

-- Create a single, correct policy for public job visibility
-- This policy allows viewing active jobs from active companies, regardless of job_posting_visibility
CREATE POLICY "Public active jobs are viewable by everyone" 
ON public.jobs 
FOR SELECT 
USING (
  status = 'active' 
  AND visibility = 'public' 
  AND EXISTS (
    SELECT 1 
    FROM companies c 
    WHERE c.id = jobs.company_id 
      AND c.account_status = 'active'
  )
);

-- Ensure job owners can always view their own jobs regardless of settings
CREATE POLICY "Job owners can view all their jobs" 
ON public.jobs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM companies c 
    WHERE c.id = jobs.company_id 
      AND c.user_id = auth.uid()
  )
);

-- Create/update the admin function to only control job posting, not job visibility
CREATE OR REPLACE FUNCTION public.admin_set_job_posting_visibility(p_user_id uuid, p_visible boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update job posting visibility setting
  -- This affects NEW job posting ability, NOT existing job visibility
  UPDATE public.employer_settings 
  SET 
    job_posting_visibility = p_visible,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- If no record exists, create it
  INSERT INTO public.employer_settings (user_id, job_posting_visibility)
  VALUES (p_user_id, p_visible)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    job_posting_visibility = p_visible,
    updated_at = now();
    
  -- Note: We do NOT change job status here
  -- Existing active jobs remain visible
  -- Only NEW job posting is controlled by this setting
END;
$$;