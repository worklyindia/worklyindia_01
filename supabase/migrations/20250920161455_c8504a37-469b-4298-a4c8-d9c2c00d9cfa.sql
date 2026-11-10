-- Fix RLS policies for guest access to jobs and companies
-- Allow public read access to active, public jobs and their associated companies

-- Update jobs table policies to allow public read access
DROP POLICY IF EXISTS "Public can view active public jobs" ON public.jobs;
CREATE POLICY "Public can view active public jobs" ON public.jobs
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

-- Update companies table policies to allow public read access for jobs
DROP POLICY IF EXISTS "Public can view active company profiles" ON public.companies;
CREATE POLICY "Public can view active company profiles" ON public.companies
  FOR SELECT
  USING (account_status = 'active');

-- Fix job_interactions table to allow anonymous view tracking
DROP POLICY IF EXISTS "Anyone can create interactions" ON public.job_interactions;
CREATE POLICY "Anyone can create interactions" ON public.job_interactions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view interactions" ON public.job_interactions
  FOR SELECT
  USING (true);

-- Allow public access to search_history for anonymous users
DROP POLICY IF EXISTS "Anyone can create search history" ON public.search_history;
CREATE POLICY "Anyone can create search history" ON public.search_history
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own search history" ON public.search_history;
CREATE POLICY "Users can view search history" ON public.search_history
  FOR SELECT
  USING (
    (auth.uid() = user_id) OR 
    (user_id IS NULL) OR 
    (auth.uid() IS NULL)
  );

-- Enable realtime for jobs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- Ensure proper replication identity for realtime
ALTER TABLE public.jobs REPLICA IDENTITY FULL;