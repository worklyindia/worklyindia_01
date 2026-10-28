-- Drop and recreate get_latest_jobs_with_priority_v2 to include api_company_name
DROP FUNCTION IF EXISTS get_latest_jobs_with_priority_v2(UUID, INT, INT);

CREATE OR REPLACE FUNCTION get_latest_jobs_with_priority_v2(
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
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
  boost_level INT,
  created_at TIMESTAMPTZ,
  views_count BIGINT,
  applications_count BIGINT,
  logo_url TEXT,
  trending_score NUMERIC,
  trending_rank INT,
  organic_rank INT,
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
  precise_address TEXT,
  api_company_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id AS job_id,
    j.title,
    COALESCE(c.company_name, 'Company') AS company,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_range,
    j.description,
    j.category,
    j.skills,
    j.is_boosted,
    j.boost_level,
    j.created_at,
    j.views_count,
    j.applications_count,
    c.logo_url,
    j.trending_score,
    j.trending_rank,
    j.organic_rank,
    j.city,
    j.state,
    j.country,
    j.languages,
    c.is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link,
    j.latitude,
    j.longitude,
    j.precise_address,
    j.api_company_name
  FROM jobs j
  LEFT JOIN companies c ON j.company_id = c.id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;