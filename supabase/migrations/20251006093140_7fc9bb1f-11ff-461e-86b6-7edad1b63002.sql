-- Fix score calculation in For You and Trending Jobs sections

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_personalized_jobs_by_location(uuid, integer, integer);

-- Recreate with trending_score in the return type
CREATE OR REPLACE FUNCTION public.get_personalized_jobs_by_location(
  p_user_id uuid DEFAULT NULL,
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
  match_score integer,
  match_reason text,
  trending_score numeric,
  city text,
  state text,
  country text,
  languages text[],
  is_verified boolean,
  verified_plan_end timestamp with time zone,
  badge_color text,
  company_instagram_link text,
  company_facebook_link text,
  company_youtube_link text,
  company_linkedin_link text,
  company_latitude numeric,
  company_longitude numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_city text;
  user_state text;
  user_country text;
  user_skills text[];
  user_preferred_location text;
  user_job_type text;
  user_industry text;
BEGIN
  -- Get user profile data if user_id is provided
  IF p_user_id IS NOT NULL THEN
    SELECT p.city, p.state, p.country, p.skills, p.preferred_location, p.job_type, p.industry
    INTO user_city, user_state, user_country, user_skills, user_preferred_location, user_job_type, user_industry
    FROM profiles p
    WHERE p.user_id = p_user_id;
  END IF;

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
    -- Calculate match_score (existing logic)
    (
      CASE WHEN j.city IS NOT NULL AND user_city IS NOT NULL AND j.city = user_city THEN 40
           WHEN j.state IS NOT NULL AND user_state IS NOT NULL AND j.state = user_state THEN 25
           WHEN j.country IS NOT NULL AND user_country IS NOT NULL AND j.country = user_country THEN 10
           ELSE 0 END +
      CASE WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 20 ELSE 0 END +
      CASE WHEN j.skills IS NOT NULL AND user_skills IS NOT NULL AND (j.skills && user_skills) THEN 30 ELSE 0 END +
      CASE WHEN user_industry IS NOT NULL AND j.category = user_industry THEN 15 ELSE 0 END +
      CASE WHEN j.created_at > now() - interval '7 days' THEN 10 ELSE 0 END
    )::integer AS match_score,
    -- Match reason
    CASE 
      WHEN j.city IS NOT NULL AND user_city IS NOT NULL AND j.city = user_city THEN 'city'
      WHEN j.state IS NOT NULL AND user_state IS NOT NULL AND j.state = user_state THEN 'state'
      WHEN j.country IS NOT NULL AND user_country IS NOT NULL AND j.country = user_country THEN 'country'
      ELSE NULL
    END AS match_reason,
    -- Calculate trending_score using the correct formula: (views × 0.10) + (applications × 1.0)
    ((COALESCE(j.views_count, 0) * 0.10) + (COALESCE(j.applications_count, 0) * 1.0))::numeric AS trending_score,
    j.city,
    j.state,
    j.country,
    j.languages,
    COALESCE(c.is_verified, false) AS is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link,
    c.latitude AS company_latitude,
    c.longitude AS company_longitude
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM job_applications ja 
      WHERE ja.job_id = j.id AND ja.user_id = p_user_id
    ))
  ORDER BY 
    j.is_boosted DESC,
    (
      CASE WHEN j.city IS NOT NULL AND user_city IS NOT NULL AND j.city = user_city THEN 40
           WHEN j.state IS NOT NULL AND user_state IS NOT NULL AND j.state = user_state THEN 25
           WHEN j.country IS NOT NULL AND user_country IS NOT NULL AND j.country = user_country THEN 10
           ELSE 0 END +
      CASE WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 20 ELSE 0 END +
      CASE WHEN j.skills IS NOT NULL AND user_skills IS NOT NULL AND (j.skills && user_skills) THEN 30 ELSE 0 END +
      CASE WHEN user_industry IS NOT NULL AND j.category = user_industry THEN 15 ELSE 0 END +
      CASE WHEN j.created_at > now() - interval '7 days' THEN 10 ELSE 0 END
    ) DESC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Recalculate all existing trending_score values in the jobs table using correct formula
UPDATE jobs
SET trending_score = (COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0)
WHERE trending_score != (COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0)
   OR trending_score IS NULL;