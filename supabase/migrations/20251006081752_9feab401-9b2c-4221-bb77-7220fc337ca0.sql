-- Drop old personalized jobs function
DROP FUNCTION IF EXISTS public.get_personalized_jobs_v3(uuid, integer, integer);

-- Create new location-based personalized jobs function
CREATE OR REPLACE FUNCTION public.get_personalized_jobs_by_location(
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
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
  user_state text;
  user_country text;
  user_skills text[];
  user_job_type text;
  user_industry text;
  state_jobs_count integer;
BEGIN
  -- Get user profile data
  IF p_user_id IS NOT NULL THEN
    SELECT 
      COALESCE(p.state, ''),
      COALESCE(p.country, 'India'),
      COALESCE(p.skills, ARRAY[]::text[]),
      COALESCE(p.job_type, ''),
      COALESCE(p.industry, '')
    INTO user_state, user_country, user_skills, user_job_type, user_industry
    FROM profiles p
    WHERE p.user_id = p_user_id;
  ELSE
    -- Guest user defaults
    user_state := '';
    user_country := 'India';
    user_skills := ARRAY[]::text[];
    user_job_type := '';
    user_industry := '';
  END IF;

  -- Check if we have state-matched jobs
  IF user_state IS NOT NULL AND user_state != '' THEN
    SELECT COUNT(*) INTO state_jobs_count
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'active'
      AND j.visibility = 'public'
      AND COALESCE(j.state, '') = user_state
      AND (p_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM job_applications ja 
        WHERE ja.job_id = j.id AND ja.user_id = p_user_id
      ));
  ELSE
    state_jobs_count := 0;
  END IF;

  -- Return state-matched jobs if found, otherwise country-matched jobs
  RETURN QUERY
  WITH matched_jobs AS (
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
      -- Calculate match score
      (
        CASE WHEN j.is_boosted THEN 100 ELSE 0 END +
        CASE WHEN j.skills && user_skills THEN 40 ELSE 0 END +
        CASE WHEN user_job_type != '' AND j.job_type = user_job_type THEN 20 ELSE 0 END +
        CASE WHEN j.created_at > now() - interval '7 days' THEN 25 ELSE 0 END +
        CASE WHEN user_industry != '' AND j.category = user_industry THEN 15 ELSE 0 END
      )::integer AS match_score,
      CASE 
        WHEN state_jobs_count > 0 THEN 'state_match'
        ELSE 'country_match'
      END AS match_reason
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'active'
      AND j.visibility = 'public'
      AND (
        -- State match has priority
        (state_jobs_count > 0 AND COALESCE(j.state, '') = user_state)
        OR
        -- Country match as fallback
        (state_jobs_count = 0 AND COALESCE(j.country, 'India') = user_country)
      )
      AND (p_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM job_applications ja 
        WHERE ja.job_id = j.id AND ja.user_id = p_user_id
      ))
  )
  SELECT 
    mj.job_id,
    mj.title,
    mj.company,
    mj.location,
    mj.job_type,
    mj.experience_level,
    mj.salary_range,
    mj.description,
    mj.category,
    mj.skills,
    mj.is_boosted,
    mj.boost_level,
    mj.created_at,
    mj.views_count,
    mj.applications_count,
    mj.logo_url,
    mj.match_score,
    mj.match_reason,
    mj.city,
    mj.state,
    mj.country,
    mj.languages,
    mj.is_verified,
    mj.verified_plan_end,
    mj.badge_color,
    mj.company_instagram_link,
    mj.company_facebook_link,
    mj.company_youtube_link,
    mj.company_linkedin_link,
    mj.company_latitude,
    mj.company_longitude
  FROM matched_jobs mj
  ORDER BY mj.match_score DESC, mj.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;