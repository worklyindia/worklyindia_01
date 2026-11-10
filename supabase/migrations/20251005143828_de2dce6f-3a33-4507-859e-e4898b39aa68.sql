-- Drop existing functions first
DROP FUNCTION IF EXISTS get_personalized_jobs_v3(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_latest_jobs_with_priority_v2(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_trending_jobs_optimized_v2(INTEGER, INTEGER);

-- Recreate get_personalized_jobs_v3 with company coordinates
CREATE FUNCTION get_personalized_jobs_v3(
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
  user_profile RECORD;
BEGIN
  SELECT 
    COALESCE(skills, ARRAY[]::TEXT[]) as skills,
    preferred_location,
    job_type as preferred_job_type,
    industry,
    COALESCE(experience_level, 0) as experience_level,
    city as user_city,
    state as user_state,
    country as user_country
  INTO user_profile
  FROM profiles
  WHERE user_id = p_user_id;

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
    (
      CASE WHEN user_profile.user_city IS NOT NULL AND j.city = user_profile.user_city THEN 50 ELSE 0 END +
      CASE WHEN user_profile.user_state IS NOT NULL AND j.state = user_profile.user_state THEN 30 ELSE 0 END +
      CASE WHEN user_profile.preferred_job_type IS NOT NULL AND j.job_type = user_profile.preferred_job_type THEN 20 ELSE 0 END +
      CASE WHEN (COALESCE(j.skills, ARRAY[]::TEXT[]) && user_profile.skills) THEN 40 ELSE 0 END +
      CASE WHEN user_profile.industry IS NOT NULL AND j.category = user_profile.industry THEN 15 ELSE 0 END +
      CASE WHEN j.is_boosted THEN 100 ELSE 0 END +
      CASE WHEN j.created_at > NOW() - INTERVAL '7 days' THEN 25 ELSE 0 END
    )::INTEGER as match_score,
    CASE 
      WHEN user_profile.user_city IS NOT NULL AND j.city = user_profile.user_city THEN 'Location Match (City)'
      WHEN user_profile.user_state IS NOT NULL AND j.state = user_profile.user_state THEN 'Location Match (State)'
      WHEN (COALESCE(j.skills, ARRAY[]::TEXT[]) && user_profile.skills) THEN 'Skills Match'
      WHEN user_profile.industry IS NOT NULL AND j.category = user_profile.industry THEN 'Industry Match'
      ELSE 'Recommended for you'
    END as match_reason,
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
    c.latitude as company_latitude,
    c.longitude as company_longitude
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
    AND (p_user_id IS NULL OR c.user_id != p_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM job_applications ja 
      WHERE ja.job_id = j.id AND ja.user_id = p_user_id
    )
  ORDER BY match_score DESC, j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Recreate get_latest_jobs_with_priority_v2 with company coordinates
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
  company_latitude NUMERIC,
  company_longitude NUMERIC
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
    CASE 
      WHEN user_city IS NOT NULL AND j.city = user_city THEN j.created_at + INTERVAL '1000 days'
      WHEN user_state IS NOT NULL AND j.state = user_state THEN j.created_at + INTERVAL '500 days'
      WHEN user_country IS NOT NULL AND j.country = user_country THEN j.created_at + INTERVAL '100 days'
      ELSE j.created_at
    END as effective_date,
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
    c.latitude as company_latitude,
    c.longitude as company_longitude
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY 
    CASE WHEN j.is_boosted THEN 1 ELSE 0 END DESC,
    effective_date DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Recreate get_trending_jobs_optimized_v2 with company coordinates
CREATE FUNCTION get_trending_jobs_optimized_v2(
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
  trending_score NUMERIC,
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
BEGIN
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
    COALESCE(j.trending_score, 0) as trending_score,
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
    c.latitude as company_latitude,
    c.longitude as company_longitude
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
    AND COALESCE(j.trending_score, 0) > 0
  ORDER BY 
    CASE WHEN j.is_boosted THEN 1 ELSE 0 END DESC,
    j.trending_score DESC,
    j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;