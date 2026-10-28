-- Additional fixes for guest access and 401 errors
-- Ensure all necessary policies are in place

-- Fix employer_settings table to allow proper checking for job visibility
CREATE POLICY IF NOT EXISTS "Public can check employer settings for job visibility" ON public.employer_settings
  FOR SELECT
  USING (job_posting_visibility = true);

-- Ensure search_history allows anonymous tracking
UPDATE public.search_history SET user_id = NULL WHERE user_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = search_history.user_id
);

-- Create a function to safely get recommended jobs without requiring authentication
CREATE OR REPLACE FUNCTION public.get_public_jobs(job_limit integer DEFAULT 10)
RETURNS TABLE(
  job_id uuid,
  title text,
  company text,
  location text,
  job_type text,
  experience_level text,
  salary_range text,
  description text,
  category text,
  skills text[],
  is_boosted boolean,
  boost_level integer,
  created_at timestamp with time zone,
  views_count integer,
  applications_count integer,
  logo_url text,
  is_verified boolean,
  verified_plan_end timestamp with time zone,
  badge_color text,
  company_instagram_link text,
  company_facebook_link text,
  company_youtube_link text,
  company_linkedin_link text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id AS job_id,
    j.title,
    COALESCE(c.company_name, '') AS company,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_range,
    j.description,
    j.category,
    j.skills,
    j.is_boosted,
    COALESCE(j.boost_level, 0) AS boost_level,
    j.created_at,
    COALESCE(j.views_count, 0) AS views_count,
    COALESCE(j.applications_count, 0) AS applications_count,
    c.logo_url,
    COALESCE(c.is_verified, false) AS is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND c.account_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.employer_settings es 
      WHERE es.user_id = c.user_id 
        AND es.job_posting_visibility = true
    )
  ORDER BY j.is_boosted DESC, j.created_at DESC
  LIMIT job_limit;
END;
$$;