-- Create function to get personalized jobs by location with proper match scoring
CREATE OR REPLACE FUNCTION public.get_personalized_jobs_by_location(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  job_id UUID,
  title TEXT,
  company TEXT,
  location TEXT,
  job_type TEXT,
  experience_level TEXT,
  salary_range TEXT,
  description TEXT,
  category TEXT,
  skills TEXT[],
  is_boosted BOOLEAN,
  boost_level INTEGER,
  created_at TIMESTAMPTZ,
  views_count INTEGER,
  applications_count INTEGER,
  logo_url TEXT,
  match_score INTEGER,
  match_reason TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  languages TEXT[],
  is_verified BOOLEAN,
  verified_plan_end TIMESTAMPTZ,
  badge_color TEXT,
  company_instagram_link TEXT,
  company_facebook_link TEXT,
  company_youtube_link TEXT,
  company_linkedin_link TEXT,
  company_latitude NUMERIC,
  company_longitude NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_state TEXT;
  user_country TEXT;
  user_skills TEXT[];
  user_job_type TEXT;
  user_category TEXT;
BEGIN
  -- Get user profile data if authenticated
  IF p_user_id IS NOT NULL THEN
    SELECT p.state, p.country, p.skills, p.job_type, p.industry
    INTO user_state, user_country, user_skills, user_job_type, user_category
    FROM public.profiles p
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
    COALESCE(j.is_boosted, false) AS is_boosted,
    COALESCE(j.boost_level, 0) AS boost_level,
    j.created_at,
    COALESCE(j.views_count, 0) AS views_count,
    COALESCE(j.applications_count, 0) AS applications_count,
    c.logo_url,
    -- Calculate match score with minimum base score
    (
      15 + -- Base score for all jobs
      CASE WHEN j.is_boosted THEN 100 ELSE 0 END +
      CASE WHEN user_state IS NOT NULL AND j.state = user_state THEN 50 ELSE 0 END +
      CASE WHEN user_country IS NOT NULL AND j.country = user_country THEN 25 ELSE 0 END +
      CASE WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 30 ELSE 0 END +
      CASE WHEN user_category IS NOT NULL AND j.category = user_category THEN 20 ELSE 0 END +
      CASE WHEN user_skills IS NOT NULL AND j.skills && user_skills THEN 40 ELSE 0 END +
      CASE WHEN j.created_at > NOW() - INTERVAL '7 days' THEN 35 ELSE 0 END +
      CASE WHEN c.is_verified THEN 25 ELSE 0 END
    )::INTEGER AS match_score,
    -- Match reason
    CASE 
      WHEN user_state IS NOT NULL AND j.state = user_state THEN 'Matches your state'
      WHEN user_country IS NOT NULL AND j.country = user_country THEN 'In your country'
      WHEN user_skills IS NOT NULL AND j.skills && user_skills THEN 'Skills match'
      WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 'Job type match'
      ELSE 'Recommended for you'
    END AS match_reason,
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
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.job_applications ja 
      WHERE ja.job_id = j.id AND ja.user_id = p_user_id
    ))
    -- Filter by state first, then country, then all
    AND (
      (user_state IS NOT NULL AND j.state = user_state) OR
      (user_state IS NULL AND user_country IS NOT NULL AND j.country = user_country) OR
      (user_state IS NULL AND user_country IS NULL)
    )
  ORDER BY 
    -- Prioritize state matches, then country matches
    CASE WHEN user_state IS NOT NULL AND j.state = user_state THEN 3
         WHEN user_country IS NOT NULL AND j.country = user_country THEN 2
         ELSE 1 
    END DESC,
    -- Then sort by calculated match score
    match_score DESC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;