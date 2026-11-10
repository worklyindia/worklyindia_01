-- Fix get_personalized_jobs_by_location to return fields matching RecommendedJob interface
-- The frontend expects specific field names like job_id, company, salary_range, etc.

-- Drop all versions of the function
DROP FUNCTION IF EXISTS get_personalized_jobs_by_location(uuid, integer);
DROP FUNCTION IF EXISTS get_personalized_jobs_by_location(uuid, integer, integer);

-- Recreate with correct return types that match RecommendedJob interface
CREATE OR REPLACE FUNCTION get_personalized_jobs_by_location(p_user_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE (
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
  views_count bigint,
  applications_count bigint,
  logo_url text,
  match_score numeric,
  match_reason text,
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
AS $$
DECLARE
  user_location text;
  user_city text;
  user_state text;
BEGIN
  SELECT p.location, p.city, p.state INTO user_location, user_city, user_state
  FROM profiles p
  WHERE p.user_id = p_user_id;

  RETURN QUERY
  SELECT 
    j.id as job_id,
    j.title,
    c.company_name as company,
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
      WHEN j.location = user_location THEN 100
      WHEN j.city = user_city THEN 80
      WHEN j.state = user_state THEN 60
      ELSE 0
    END::numeric as match_score,
    CASE 
      WHEN j.location = user_location THEN 'Perfect location match'
      WHEN j.city = user_city THEN 'Same city'
      WHEN j.state = user_state THEN 'Same state'
      ELSE 'Popular job'
    END as match_reason,
    j.city,
    j.state,
    j.country,
    j.languages,
    COALESCE(c.is_verified, false) as is_verified,
    c.verified_plan_end,
    COALESCE(c.badge_color, 'gold') as badge_color,
    c.instagram_link as company_instagram_link,
    c.facebook_link as company_facebook_link,
    c.youtube_link as company_youtube_link,
    c.linkedin_link as company_linkedin_link,
    c.latitude as company_latitude,
    c.longitude as company_longitude
  FROM jobs j
  INNER JOIN companies c ON j.company_id = c.id
  WHERE j.status = 'active' 
    AND (j.expires_at IS NULL OR j.expires_at > NOW())
    AND c.account_status = 'active'
  ORDER BY match_score DESC, is_boosted DESC, j.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Version with limit and offset
CREATE OR REPLACE FUNCTION get_personalized_jobs_by_location(p_user_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (
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
  views_count bigint,
  applications_count bigint,
  logo_url text,
  match_score numeric,
  match_reason text,
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
AS $$
DECLARE
  user_location text;
  user_city text;
  user_state text;
BEGIN
  SELECT p.location, p.city, p.state INTO user_location, user_city, user_state
  FROM profiles p
  WHERE p.user_id = p_user_id;

  RETURN QUERY
  SELECT 
    j.id as job_id,
    j.title,
    c.company_name as company,
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
      WHEN j.location = user_location THEN 100
      WHEN j.city = user_city THEN 80
      WHEN j.state = user_state THEN 60
      ELSE 0
    END::numeric as match_score,
    CASE 
      WHEN j.location = user_location THEN 'Perfect location match'
      WHEN j.city = user_city THEN 'Same city'
      WHEN j.state = user_state THEN 'Same state'
      ELSE 'Popular job'
    END as match_reason,
    j.city,
    j.state,
    j.country,
    j.languages,
    COALESCE(c.is_verified, false) as is_verified,
    c.verified_plan_end,
    COALESCE(c.badge_color, 'gold') as badge_color,
    c.instagram_link as company_instagram_link,
    c.facebook_link as company_facebook_link,
    c.youtube_link as company_youtube_link,
    c.linkedin_link as company_linkedin_link,
    c.latitude as company_latitude,
    c.longitude as company_longitude
  FROM jobs j
  INNER JOIN companies c ON j.company_id = c.id
  WHERE j.status = 'active' 
    AND (j.expires_at IS NULL OR j.expires_at > NOW())
    AND c.account_status = 'active'
  ORDER BY match_score DESC, is_boosted DESC, j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;