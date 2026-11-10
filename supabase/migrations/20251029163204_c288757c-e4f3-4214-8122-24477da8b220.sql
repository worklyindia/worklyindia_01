-- Fix security issues identified in security scan

-- 1. Remove public counting policy on job_applications table
DROP POLICY IF EXISTS "Anyone can count job applications" ON public.job_applications;

-- 2. Drop existing SELECT policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own job applications" ON public.job_applications;
DROP POLICY IF EXISTS "Employers can view applications to their jobs" ON public.job_applications;

-- Create policy for applicants to view their own applications
CREATE POLICY "Users can view their own job applications"
  ON public.job_applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for employers to view applications to their jobs  
-- (need to join through companies table since jobs has company_id, not user_id)
CREATE POLICY "Employers can view applications to their jobs"
  ON public.job_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.jobs j
      JOIN public.companies c ON c.id = j.company_id
      WHERE j.id = job_applications.job_id
      AND c.user_id = auth.uid()
    )
  );

-- 3. Add search_path protection to commonly used SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_admin_role()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
    AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add comments
COMMENT ON POLICY "Users can view their own job applications" ON public.job_applications IS 
'Security fix: Restrict application viewing to applicant and employer only';

COMMENT ON POLICY "Employers can view applications to their jobs" ON public.job_applications IS 
'Security fix: Allow employers to view applications for their job postings via company ownership';
