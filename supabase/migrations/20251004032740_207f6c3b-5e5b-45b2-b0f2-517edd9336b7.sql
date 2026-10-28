-- Fix get_personalized_jobs function to ensure it works for all users
CREATE OR REPLACE FUNCTION public.get_personalized_jobs(
  u_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
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
  score integer,
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
  -- If user is authenticated, get personalized recommendations
  IF u_id IS NOT NULL THEN
    RETURN QUERY
    SELECT * FROM public.get_recommended_jobs(u_id)
    LIMIT p_limit OFFSET p_offset;
  ELSE
    -- For guest users, return latest active jobs
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
      (CASE WHEN j.is_boosted THEN 100 ELSE 0 END + 
       CASE WHEN j.created_at > now() - interval '7 days' THEN 40 ELSE 0 END)::int AS score,
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
    ORDER BY j.is_boosted DESC, j.created_at DESC
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$;