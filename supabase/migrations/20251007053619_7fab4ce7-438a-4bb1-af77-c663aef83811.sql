-- Lower trending jobs threshold from 5.0 to 2.0 for better visibility
-- This allows jobs with 20 views OR 2 applications to appear in trending

CREATE OR REPLACE FUNCTION get_trending_jobs_optimized_v2(
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
  trending_score NUMERIC,
  location_match TEXT,
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
) AS $$
DECLARE
  user_city TEXT;
  user_state TEXT;
  user_country TEXT;
BEGIN
  -- Get user's location if user_id is provided
  IF p_user_id IS NOT NULL THEN
    SELECT p.city, p.state, p.country 
    INTO user_city, user_state, user_country
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
    COALESCE(j.is_boosted, false) AS is_boosted,
    COALESCE(j.boost_level, 0) AS boost_level,
    j.created_at,
    COALESCE(j.views_count, 0) AS views_count,
    COALESCE(j.applications_count, 0) AS applications_count,
    c.logo_url,
    -- Include boost in trending_score
    (
      (COALESCE(j.views_count, 0) * 0.10) + 
      (COALESCE(j.applications_count, 0) * 1.0) +
      CASE 
        WHEN COALESCE(j.is_boosted, false) = true AND j.boost_end_date > NOW() 
        THEN j.boost_level * 100.0 
        ELSE 0 
      END
    ) AS trending_score,
    -- Location matching
    CASE
      WHEN user_city IS NOT NULL AND LOWER(j.city) = LOWER(user_city) THEN 'city'
      WHEN user_state IS NOT NULL AND LOWER(j.state) = LOWER(user_state) THEN 'state'
      WHEN user_country IS NOT NULL AND LOWER(j.country) = LOWER(user_country) THEN 'country'
      ELSE NULL
    END AS location_match,
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
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND (j.published_at IS NULL OR j.published_at <= NOW())
    AND (j.expires_at IS NULL OR j.expires_at > NOW())
    -- Filter: Show jobs with base_score >= 2.0 OR boosted jobs
    AND (
      ((COALESCE(j.views_count, 0) * 0.10) + (COALESCE(j.applications_count, 0) * 1.0)) >= 2.0
      OR (COALESCE(j.is_boosted, false) = true AND j.boost_end_date > NOW())
    )
    -- Exclude user's own jobs if authenticated
    AND (p_user_id IS NULL OR c.user_id != p_user_id)
    -- Exclude already applied jobs
    AND (
      p_user_id IS NULL OR 
      NOT EXISTS (
        SELECT 1 FROM job_applications ja 
        WHERE ja.job_id = j.id AND ja.user_id = p_user_id
      )
    )
  ORDER BY trending_score DESC, j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;