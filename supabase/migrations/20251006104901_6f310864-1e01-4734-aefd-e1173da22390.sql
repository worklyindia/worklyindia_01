-- Fix location matching to ensure hierarchical validation (city + state + country)
CREATE OR REPLACE FUNCTION public.get_personalized_jobs_by_location(
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_location_priority text DEFAULT 'mixed'
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
  user_skills text[];
  user_job_type text;
  user_industry text;
  user_experience_level integer;
BEGIN
  -- Fetch fresh user profile data
  IF p_user_id IS NOT NULL THEN
    SELECT 
      COALESCE(p.city, ''),
      COALESCE(p.state, ''),
      COALESCE(p.country, 'India'),
      COALESCE(p.skills, ARRAY[]::text[]),
      p.job_type,
      p.industry,
      COALESCE(p.experience_level, 0)
    INTO 
      user_city, user_state, user_country, user_skills, user_job_type, user_industry, user_experience_level
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
    (
      -- Location matching (priority based with hierarchical validation)
      CASE 
        WHEN p_location_priority = 'city_first' AND user_city != '' AND j.city = user_city AND j.state = user_state AND j.country = user_country THEN 100
        WHEN p_location_priority = 'state_fallback' AND user_state != '' AND j.state = user_state AND j.country = user_country THEN 80
        WHEN p_location_priority = 'mixed' AND user_city != '' AND j.city = user_city AND j.state = user_state AND j.country = user_country THEN 100
        WHEN p_location_priority = 'mixed' AND user_state != '' AND j.state = user_state AND j.country = user_country THEN 80
        ELSE 0
      END +
      -- Skills matching
      CASE WHEN p_user_id IS NOT NULL AND (j.skills && user_skills) THEN 50 ELSE 0 END +
      -- Job type matching
      CASE WHEN p_user_id IS NOT NULL AND user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 20 ELSE 0 END +
      -- Industry matching
      CASE WHEN p_user_id IS NOT NULL AND user_industry IS NOT NULL AND j.category = user_industry THEN 15 ELSE 0 END +
      -- Experience level matching
      CASE 
        WHEN p_user_id IS NOT NULL AND user_experience_level >= 
          (CASE 
            WHEN j.experience_level IS NULL THEN 0
            WHEN LOWER(j.experience_level) IN ('fresher','entry','0-1','0-1 years','0') THEN 0
            WHEN LOWER(j.experience_level) ~ '(1\s*-\s*3|junior)' THEN 1
            WHEN LOWER(j.experience_level) ~ '(3\s*-\s*5|mid)' THEN 2
            WHEN LOWER(j.experience_level) ~ '(5\s*\+|5\s*-\s*8|senior)' THEN 3
            ELSE 0
          END)
        THEN 10 ELSE 0 END +
      -- Boost bonus
      CASE WHEN j.is_boosted THEN 100 ELSE 0 END +
      -- Recency bonus
      CASE WHEN j.created_at > NOW() - INTERVAL '7 days' THEN 40 ELSE 0 END
    )::integer AS match_score,
    CASE 
      WHEN p_location_priority = 'city_first' AND user_city != '' AND j.city = user_city AND j.state = user_state AND j.country = user_country THEN 'City match: ' || user_city || ', ' || user_state
      WHEN p_location_priority = 'state_fallback' AND user_state != '' AND j.state = user_state AND j.country = user_country THEN 'State match: ' || user_state
      WHEN p_location_priority = 'mixed' AND user_city != '' AND j.city = user_city AND j.state = user_state AND j.country = user_country THEN 'City match: ' || user_city || ', ' || user_state
      WHEN p_location_priority = 'mixed' AND user_state != '' AND j.state = user_state AND j.country = user_country THEN 'State match: ' || user_state
      ELSE 'General recommendation'
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
    c.longitude AS company_longitude
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM job_applications ja 
      WHERE ja.job_id = j.id AND ja.user_id = p_user_id
    ))
    -- Location filtering with hierarchical validation (city + state + country OR state + country)
    AND (
      (p_location_priority = 'city_first' AND user_city != '' AND j.city = user_city AND j.state = user_state AND j.country = user_country) OR
      (p_location_priority = 'state_fallback' AND user_state != '' AND j.state = user_state AND j.country = user_country) OR
      (p_location_priority = 'mixed')
    )
  ORDER BY 
    COALESCE(j.is_boosted, false) DESC,
    match_score DESC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;