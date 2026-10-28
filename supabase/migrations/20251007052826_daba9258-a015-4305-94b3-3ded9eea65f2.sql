-- Fix trending score calculation to include boost and add threshold filtering
-- Drop and recreate the get_trending_jobs_optimized_v2 function with correct logic

DROP FUNCTION IF EXISTS get_trending_jobs_optimized_v2(uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_trending_jobs_optimized_v2(
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
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
  created_at timestamptz,
  views_count integer,
  applications_count integer,
  logo_url text,
  trending_score numeric,
  location_match text,
  city text,
  state text,
  country text,
  languages text[],
  is_verified boolean,
  verified_plan_end timestamptz,
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
BEGIN
  -- Get user's location if authenticated
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
    -- Calculate trending score: base score + boost bonus (if active)
    (
      ((COALESCE(j.views_count, 0) * 0.10) + (COALESCE(j.applications_count, 0) * 1.0)) +
      CASE 
        WHEN COALESCE(j.is_boosted, false) = true AND j.boost_end_date > NOW() 
        THEN COALESCE(j.boost_level, 0) * 100.0
        ELSE 0 
      END
    )::numeric AS trending_score,
    -- Location match level
    CASE
      WHEN user_city IS NOT NULL AND j.city = user_city THEN 'city'
      WHEN user_state IS NOT NULL AND j.state = user_state THEN 'state'
      WHEN user_country IS NOT NULL AND j.country = user_country THEN 'country'
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
    AND (
      -- Only show jobs with trending score >= 5 OR boosted jobs
      ((COALESCE(j.views_count, 0) * 0.10) + (COALESCE(j.applications_count, 0) * 1.0)) >= 5.0
      OR (COALESCE(j.is_boosted, false) = true AND j.boost_end_date > NOW())
    )
  ORDER BY 
    -- Sort by total trending score (base + boost)
    (
      ((COALESCE(j.views_count, 0) * 0.10) + (COALESCE(j.applications_count, 0) * 1.0)) +
      CASE 
        WHEN COALESCE(j.is_boosted, false) = true AND j.boost_end_date > NOW() 
        THEN COALESCE(j.boost_level, 0) * 100.0
        ELSE 0 
      END
    ) DESC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Update the calculate_trending_score function to return base score only (without boost)
-- Boost is added dynamically in queries
CREATE OR REPLACE FUNCTION calculate_trending_score(job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  views_count integer;
  applications_count integer;
  base_score numeric;
BEGIN
  -- Get current counts
  SELECT 
    COALESCE(j.views_count, 0),
    COALESCE(j.applications_count, 0)
  INTO views_count, applications_count
  FROM jobs j
  WHERE j.id = job_id;
  
  -- Calculate base trending score (views × 0.10) + (applications × 1.0)
  base_score := (views_count * 0.10) + (applications_count * 1.0);
  
  RETURN base_score;
END;
$$;