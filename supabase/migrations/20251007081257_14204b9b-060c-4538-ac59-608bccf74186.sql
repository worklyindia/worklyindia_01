-- Fix get_personalized_jobs_by_location to include location_match_level field
-- This field determines which badge to show: city/state/country match

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
  company_longitude numeric,
  location_match_level text  -- ADDED THIS CRITICAL FIELD
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_skills text[];
  user_preferred_location text;
  user_job_type text;
  user_industry text;
  user_experience_level integer;
  user_city text;
  user_state text;
  user_country text;
BEGIN
  -- Get user profile data if user_id is provided
  IF p_user_id IS NOT NULL THEN
    SELECT 
      COALESCE(p.skills, ARRAY[]::text[]),
      p.preferred_location,
      p.job_type,
      p.industry,
      COALESCE(p.experience_level, 0),
      COALESCE(p.city, ''),
      COALESCE(p.state, ''),
      COALESCE(p.country, 'India')
    INTO 
      user_skills,
      user_preferred_location,
      user_job_type,
      user_industry,
      user_experience_level,
      user_city,
      user_state,
      user_country
    FROM profiles p
    WHERE p.user_id = p_user_id;
  ELSE
    -- For guest users, set default location to India
    user_country := 'India';
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
    (
      -- Location matching (city > state > country)
      CASE 
        WHEN user_city IS NOT NULL AND user_city != '' AND j.city = user_city THEN 50
        WHEN user_state IS NOT NULL AND user_state != '' AND j.state = user_state THEN 30
        WHEN user_country IS NOT NULL AND user_country != '' AND j.country = user_country THEN 15
        ELSE 0
      END +
      -- Skills matching
      CASE 
        WHEN user_skills IS NOT NULL AND (j.skills && user_skills) THEN 40
        ELSE 0
      END +
      -- Job type matching
      CASE 
        WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 25
        ELSE 0
      END +
      -- Industry/category matching
      CASE 
        WHEN user_industry IS NOT NULL AND j.category = user_industry THEN 20
        ELSE 0
      END +
      -- Experience level matching
      CASE 
        WHEN user_experience_level >= 
          (CASE 
            WHEN j.experience_level IS NULL THEN 0
            WHEN lower(j.experience_level) IN ('fresher','entry','0-1','0-1 years','0') THEN 0
            WHEN lower(j.experience_level) ~ '(1\s*-\s*3|junior)' THEN 1
            WHEN lower(j.experience_level) ~ '(3\s*-\s*5|mid)' THEN 2
            WHEN lower(j.experience_level) ~ '(5\s*\+|5\s*-\s*8|senior)' THEN 3
            ELSE 0
          END)
        THEN 15
        ELSE 0
      END +
      -- Boost bonus
      CASE WHEN j.is_boosted THEN 100 ELSE 0 END
    )::integer AS match_score,
    (
      CASE 
        WHEN user_city IS NOT NULL AND user_city != '' AND j.city = user_city THEN 'Same city'
        WHEN user_state IS NOT NULL AND user_state != '' AND j.state = user_state THEN 'Same state'
        WHEN user_country IS NOT NULL AND user_country != '' AND j.country = user_country THEN 'Same country'
        WHEN user_skills IS NOT NULL AND (j.skills && user_skills) THEN 'Matching skills'
        WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 'Matching job type'
        ELSE 'Recommended for you'
      END
    ) AS match_reason,
    ((COALESCE(j.views_count, 0) * 0.10) + (COALESCE(j.applications_count, 0) * 1.0))::numeric AS trending_score,
    COALESCE(j.city, '') AS city,
    COALESCE(j.state, '') AS state,
    COALESCE(j.country, '') AS country,
    j.languages,
    COALESCE(c.is_verified, false) AS is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link,
    j.latitude AS company_latitude,
    j.longitude AS company_longitude,
    -- CRITICAL FIX: Return location_match_level to show correct badges
    (
      CASE 
        WHEN user_city IS NOT NULL AND user_city != '' AND j.city = user_city THEN 'city'
        WHEN user_state IS NOT NULL AND user_state != '' AND j.state = user_state THEN 'state'
        WHEN user_country IS NOT NULL AND user_country != '' AND j.country = user_country THEN 'country'
        ELSE NULL
      END
    )::text AS location_match_level
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM job_applications ja 
      WHERE ja.job_id = j.id AND ja.user_id = p_user_id
    ))
    -- Apply location filtering based on priority
    AND (
      CASE p_location_priority
        WHEN 'city_first' THEN (user_city IS NOT NULL AND user_city != '' AND j.city = user_city)
        WHEN 'state_fallback' THEN (user_state IS NOT NULL AND user_state != '' AND j.state = user_state)
        WHEN 'country_only' THEN (user_country IS NOT NULL AND user_country != '' AND j.country = user_country)
        ELSE TRUE
      END
    )
  ORDER BY 
    match_score DESC,
    j.is_boosted DESC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;