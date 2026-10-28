-- Drop existing function
DROP FUNCTION IF EXISTS public.get_personalized_jobs_by_location(uuid, integer, integer, text);

-- Create improved function with better NULL location handling
CREATE OR REPLACE FUNCTION public.get_personalized_jobs_by_location(
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_location_priority text DEFAULT 'city_first'
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
  created_at timestamptz,
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
  verified_plan_end timestamptz,
  badge_color text,
  company_instagram_link text,
  company_facebook_link text,
  company_youtube_link text,
  company_linkedin_link text,
  company_latitude numeric,
  company_longitude numeric,
  location_match_level text
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
  user_job_type text;
  user_industry text;
  user_experience integer;
BEGIN
  -- Get user profile data
  IF p_user_id IS NOT NULL THEN
    SELECT 
      COALESCE(p.city, ''),
      COALESCE(p.state, ''),
      COALESCE(p.country, 'India'),
      COALESCE(p.skills, ARRAY[]::text[]),
      p.job_type,
      p.industry,
      COALESCE(p.experience_level, 0)
    INTO user_city, user_state, user_country, user_skills, user_job_type, user_industry, user_experience
    FROM profiles p
    WHERE p.user_id = p_user_id;
  ELSE
    -- Guest user defaults
    user_country := 'India';
    user_skills := ARRAY[]::text[];
    user_experience := 0;
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
    -- Match scoring
    (
      CASE WHEN user_city != '' AND j.city = user_city THEN 30 ELSE 0 END +
      CASE WHEN user_state != '' AND j.state = user_state THEN 20 ELSE 0 END +
      CASE WHEN j.country = user_country THEN 10 ELSE 0 END +
      CASE WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 15 ELSE 0 END +
      CASE WHEN user_skills != ARRAY[]::text[] AND (j.skills && user_skills) THEN 25 ELSE 0 END +
      CASE WHEN j.is_boosted THEN 100 ELSE 0 END +
      CASE WHEN j.created_at > now() - interval '7 days' THEN 20 ELSE 0 END
    )::integer AS match_score,
    CASE 
      WHEN user_city != '' AND j.city = user_city THEN 'City match'
      WHEN user_state != '' AND j.state = user_state THEN 'State match'
      WHEN j.country = user_country THEN 'Country match'
      ELSE 'General'
    END AS match_reason,
    COALESCE(j.trending_score, 0) AS trending_score,
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
    c.longitude AS company_longitude,
    -- Location match level for badge display
    CASE 
      WHEN user_city != '' AND j.city = user_city THEN 'city'
      WHEN user_state != '' AND j.state = user_state THEN 'state'
      WHEN j.country = user_country THEN 'country'
      ELSE NULL
    END::text AS location_match_level
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM job_applications ja 
      WHERE ja.job_id = j.id AND ja.user_id = p_user_id
    ))
    AND (
      -- City-first priority
      (p_location_priority = 'city_first' AND user_city != '' AND j.city = user_city)
      OR
      -- State fallback
      (p_location_priority = 'state_fallback' AND user_state != '' AND j.state = user_state)
      OR
      -- Country only (default fallback for NULL or incomplete profiles)
      (p_location_priority = 'country_only' AND j.country = user_country)
    )
  ORDER BY 
    j.is_boosted DESC,
    match_score DESC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;