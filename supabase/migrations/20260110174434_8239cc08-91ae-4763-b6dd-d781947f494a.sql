-- Fix type mismatch in get_latest_jobs_with_priority_v2
DROP FUNCTION IF EXISTS get_latest_jobs_with_priority_v2(uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_latest_jobs_with_priority_v2(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  job_id TEXT,
  short_id TEXT,
  public_slug TEXT,
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
  views_count BIGINT,
  applications_count BIGINT,
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
  precise_address TEXT,
  trending_score NUMERIC,
  base_score NUMERIC,
  trending_rank INTEGER,
  organic_rank INTEGER,
  is_new BOOLEAN,
  api_company_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT 
      j.id::TEXT as job_id,
      j.short_id::TEXT as short_id,
      j.public_slug::TEXT as public_slug,
      j.title,
      COALESCE(c.company_name, j.api_company_name, '') as company,
      COALESCE(j.location, c.location, concat_ws(', ', NULLIF(j.city,''), NULLIF(j.state,''), NULLIF(j.country,''))) as location,
      j.job_type,
      j.experience_level,
      j.salary_range,
      j.description,
      j.category,
      j.skills,
      j.is_boosted,
      COALESCE(j.boost_level, 0) as boost_level,
      j.created_at,
      j.views_count::BIGINT as views_count,
      j.applications_count::BIGINT as applications_count,
      c.logo_url,
      NULL::TEXT as location_match,
      j.created_at as effective_date,
      COALESCE(j.city, c.city) as city,
      COALESCE(j.state, c.state) as state,
      COALESCE(j.country, c.country) as country,
      j.languages,
      COALESCE(c.is_verified, false) as is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link as company_instagram_link,
      c.facebook_link as company_facebook_link,
      c.youtube_link as company_youtube_link,
      c.linkedin_link as company_linkedin_link,
      j.latitude::NUMERIC as latitude,
      j.longitude::NUMERIC as longitude,
      COALESCE(j.precise_address, c.registered_address) as precise_address,
      COALESCE(j.trending_score, 0) as trending_score,
      0::NUMERIC as base_score,
      j.trending_rank as trending_rank,
      j.organic_rank as organic_rank,
      (j.created_at > NOW() - INTERVAL '24 hours') as is_new,
      j.api_company_name
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'active'
      AND (j.visibility IS NULL OR j.visibility = 'public')
      AND (c.account_status IS NULL OR c.account_status = 'active')
    ORDER BY 
      j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;