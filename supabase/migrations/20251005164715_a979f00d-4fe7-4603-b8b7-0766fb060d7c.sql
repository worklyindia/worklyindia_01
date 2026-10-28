-- Fix Latest Jobs sorting to show newest jobs first by actual created_at
DROP FUNCTION IF EXISTS get_latest_jobs_with_priority_v2(UUID, INTEGER, INTEGER);

CREATE FUNCTION get_latest_jobs_with_priority_v2(
  p_user_id UUID,
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
  location_match TEXT,
  effective_date TIMESTAMPTZ,
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
  latitude NUMERIC,
  longitude NUMERIC,
  precise_address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_city TEXT;
  user_state TEXT;
  user_country TEXT;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT city, state, country 
    INTO user_city, user_state, user_country
    FROM profiles 
    WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT 
    j.id as job_id,
    j.title,
    COALESCE(c.company_name, '') as company,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_range,
    j.description,
    j.category,
    j.skills,
    COALESCE(j.is_boosted, false) as is_boosted,
    COALESCE(j.boost_level, 0) as boost_level,
    j.created_at,
    COALESCE(j.views_count, 0) as views_count,
    COALESCE(j.applications_count, 0) as applications_count,
    c.logo_url,
    CASE 
      WHEN user_city IS NOT NULL AND j.city = user_city THEN 'city'
      WHEN user_state IS NOT NULL AND j.state = user_state THEN 'state'
      WHEN user_country IS NOT NULL AND j.country = user_country THEN 'country'
      ELSE NULL
    END as location_match,
    j.created_at as effective_date,
    j.city,
    j.state,
    j.country,
    j.languages,
    COALESCE(c.is_verified, false) as is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link as company_instagram_link,
    c.facebook_link as company_facebook_link,
    c.youtube_link as company_youtube_link,
    c.linkedin_link as company_linkedin_link,
    j.latitude,
    j.longitude,
    j.precise_address
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;