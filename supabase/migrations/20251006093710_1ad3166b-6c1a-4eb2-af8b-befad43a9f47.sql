-- Update get_personalized_jobs_by_location to sort by trending_score
CREATE OR REPLACE FUNCTION public.get_personalized_jobs_by_location(
  p_user_id uuid DEFAULT NULL::uuid,
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
SET search_path TO 'public'
AS $function$
DECLARE
  user_location TEXT;
  user_city TEXT;
  user_state TEXT;
  user_country TEXT;
  user_skills TEXT[];
  user_job_type TEXT;
  user_industry TEXT;
  user_experience_level INTEGER;
  user_latitude NUMERIC;
  user_longitude NUMERIC;
BEGIN
  -- Get user profile data if user_id is provided
  IF p_user_id IS NOT NULL THEN
    SELECT 
      p.location,
      p.city,
      p.state,
      p.country,
      COALESCE(p.skills, '{}'::text[]),
      p.job_type,
      p.industry,
      COALESCE(p.experience_level, 0),
      p.latitude,
      p.longitude
    INTO 
      user_location,
      user_city,
      user_state,
      user_country,
      user_skills,
      user_job_type,
      user_industry,
      user_experience_level,
      user_latitude,
      user_longitude
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
    -- Calculate match score
    (
      CASE WHEN p_user_id IS NULL THEN 0
      ELSE
        (CASE WHEN user_city IS NOT NULL AND j.city = user_city THEN 40 ELSE 0 END) +
        (CASE WHEN user_state IS NOT NULL AND j.state = user_state THEN 25 ELSE 0 END) +
        (CASE WHEN user_country IS NOT NULL AND j.country = user_country THEN 10 ELSE 0 END) +
        (CASE WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 20 ELSE 0 END) +
        (CASE WHEN (COALESCE(j.skills, '{}'::text[]) && user_skills) THEN 50 ELSE 0 END) +
        (CASE WHEN user_industry IS NOT NULL AND j.category = user_industry THEN 15 ELSE 0 END)
      END
    )::integer AS match_score,
    -- Match reason
    CASE 
      WHEN p_user_id IS NULL THEN 'Guest user - showing popular jobs'
      WHEN user_city IS NOT NULL AND j.city = user_city THEN 'Matches your city: ' || user_city
      WHEN user_state IS NOT NULL AND j.state = user_state THEN 'Matches your state: ' || user_state
      WHEN (COALESCE(j.skills, '{}'::text[]) && user_skills) THEN 'Matches your skills'
      WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 'Matches your preferred job type'
      ELSE 'Recommended for you'
    END AS match_reason,
    -- Trending score
    ((COALESCE(j.views_count, 0) * 0.10) + (COALESCE(j.applications_count, 0) * 1.0))::numeric AS trending_score,
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
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND (p_user_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.job_applications ja 
      WHERE ja.job_id = j.id AND ja.user_id = p_user_id
    ))
  ORDER BY 
    COALESCE(j.is_boosted, false) DESC,
    ((COALESCE(j.views_count, 0) * 0.10) + (COALESCE(j.applications_count, 0) * 1.0)) DESC,
    (
      CASE WHEN p_user_id IS NULL THEN 0
      ELSE
        (CASE WHEN user_city IS NOT NULL AND j.city = user_city THEN 40 ELSE 0 END) +
        (CASE WHEN user_state IS NOT NULL AND j.state = user_state THEN 25 ELSE 0 END) +
        (CASE WHEN user_country IS NOT NULL AND j.country = user_country THEN 10 ELSE 0 END) +
        (CASE WHEN user_job_type IS NOT NULL AND j.job_type = user_job_type THEN 20 ELSE 0 END) +
        (CASE WHEN (COALESCE(j.skills, '{}'::text[]) && user_skills) THEN 50 ELSE 0 END) +
        (CASE WHEN user_industry IS NOT NULL AND j.category = user_industry THEN 15 ELSE 0 END)
      END
    ) DESC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;