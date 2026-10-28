-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS public.get_personalized_jobs_v3(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_latest_jobs_with_priority_v2(integer, integer);
DROP FUNCTION IF EXISTS public.get_trending_jobs_optimized_v2(integer, integer);

-- Create get_personalized_jobs_v3 with company coordinates for distance calculation
CREATE OR REPLACE FUNCTION public.get_personalized_jobs_v3(
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
  is_verified boolean,
  verified_plan_end timestamp with time zone,
  badge_color text,
  company_instagram_link text,
  company_facebook_link text,
  company_youtube_link text,
  company_linkedin_link text,
  match_score integer,
  match_reason text,
  city text,
  state text,
  country text,
  languages text[],
  company_latitude numeric,
  company_longitude numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get user profile if authenticated
  IF p_user_id IS NOT NULL THEN
    SELECT 
      COALESCE(p.skills, '{}'::text[]) AS skills,
      p.city,
      p.state,
      p.country,
      p.preferred_location,
      p.job_type,
      p.industry,
      COALESCE(p.experience_level, 0) AS experience_level,
      COALESCE(p.languages, '{}'::text[]) AS languages
    INTO user_profile
    FROM public.profiles p
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
    COALESCE(c.is_verified, false) AS is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link,
    -- Match scoring
    (
      CASE WHEN p_user_id IS NULL THEN 0 ELSE
        COALESCE(
          (CASE WHEN user_profile.city IS NOT NULL AND j.city = user_profile.city THEN 50 ELSE 0 END) +
          (CASE WHEN user_profile.state IS NOT NULL AND j.state = user_profile.state THEN 30 ELSE 0 END) +
          (CASE WHEN user_profile.country IS NOT NULL AND j.country = user_profile.country THEN 10 ELSE 0 END) +
          (CASE WHEN user_profile.job_type IS NOT NULL AND j.job_type = user_profile.job_type THEN 20 ELSE 0 END) +
          (CASE WHEN (COALESCE(j.skills, '{}'::text[]) && user_profile.skills) THEN 40 ELSE 0 END) +
          (CASE WHEN user_profile.industry IS NOT NULL AND j.category = user_profile.industry THEN 15 ELSE 0 END) +
          (CASE WHEN (COALESCE(j.languages, '{}'::text[]) && user_profile.languages) THEN 10 ELSE 0 END),
          0
        )
      END +
      (CASE WHEN j.is_boosted THEN 100 ELSE 0 END) +
      (CASE WHEN j.created_at > now() - interval '7 days' THEN 40 ELSE 0 END)
    )::integer AS match_score,
    -- Match reason
    CASE 
      WHEN p_user_id IS NULL THEN 'general'
      WHEN user_profile.city IS NOT NULL AND j.city = user_profile.city THEN 'city_match'
      WHEN user_profile.state IS NOT NULL AND j.state = user_profile.state THEN 'state_match'
      WHEN user_profile.country IS NOT NULL AND j.country = user_profile.country THEN 'country_match'
      WHEN (COALESCE(j.skills, '{}'::text[]) && user_profile.skills) THEN 'skills_match'
      WHEN user_profile.job_type IS NOT NULL AND j.job_type = user_profile.job_type THEN 'job_type_match'
      ELSE 'general'
    END::text AS match_reason,
    j.city,
    j.state,
    j.country,
    j.languages,
    c.latitude AS company_latitude,
    c.longitude AS company_longitude
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.job_applications ja 
      WHERE ja.job_id = j.id AND ja.user_id = p_user_id
    ))
  ORDER BY match_score DESC, j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Create get_latest_jobs_with_priority_v2 with company coordinates
CREATE OR REPLACE FUNCTION public.get_latest_jobs_with_priority_v2(
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
  is_verified boolean,
  verified_plan_end timestamp with time zone,
  badge_color text,
  company_instagram_link text,
  company_facebook_link text,
  company_youtube_link text,
  company_linkedin_link text,
  city text,
  state text,
  country text,
  languages text[],
  company_latitude numeric,
  company_longitude numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    COALESCE(c.is_verified, false) AS is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link,
    j.city,
    j.state,
    j.country,
    j.languages,
    c.latitude AS company_latitude,
    c.longitude AS company_longitude
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY 
    j.is_boosted DESC,
    j.boost_level DESC,
    j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Create get_trending_jobs_optimized_v2 with company coordinates
CREATE OR REPLACE FUNCTION public.get_trending_jobs_optimized_v2(
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
  trending_score numeric,
  is_verified boolean,
  verified_plan_end timestamp with time zone,
  badge_color text,
  company_instagram_link text,
  company_facebook_link text,
  company_youtube_link text,
  company_linkedin_link text,
  city text,
  state text,
  country text,
  languages text[],
  company_latitude numeric,
  company_longitude numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    COALESCE(j.trending_score, 0) AS trending_score,
    COALESCE(c.is_verified, false) AS is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link,
    j.city,
    j.state,
    j.country,
    j.languages,
    c.latitude AS company_latitude,
    c.longitude AS company_longitude
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND j.trending_score > 0
  ORDER BY 
    j.is_boosted DESC,
    j.trending_score DESC,
    j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;