-- Create enhanced personalized jobs function with strict priority order
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
  created_at timestamptz,
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
  verified_plan_end timestamptz,
  badge_color text,
  company_instagram_link text,
  company_facebook_link text,
  company_youtube_link text,
  company_linkedin_link text
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
  user_languages text[];
BEGIN
  -- Get user profile data
  IF p_user_id IS NOT NULL THEN
    SELECT p.city, p.state, p.country, p.skills, p.languages
    INTO user_city, user_state, user_country, user_skills, user_languages
    FROM profiles p
    WHERE p.user_id = p_user_id;
  END IF;

  RETURN QUERY
  WITH scored_jobs AS (
    SELECT 
      j.id as job_id,
      j.title,
      COALESCE(c.company_name, '') as company,
      j.location,
      j.job_type,
      j.experience_level,
      j.salary_range,
      j.description,
      j.category,
      j.skills,
      j.is_boosted,
      COALESCE(j.boost_level, 0) as boost_level,
      j.created_at,
      COALESCE(j.views_count, 0) as views_count,
      COALESCE(j.applications_count, 0) as applications_count,
      c.logo_url,
      j.city,
      j.state,
      j.country,
      j.languages,
      COALESCE(c.is_verified, false) as is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link as company_instagram_link,
      c.facebook_link as company_facebook_link,
      c.youtube_link as company_youtube_link,
      c.linkedin_link as company_linkedin_link,
      
      -- Location scoring (highest priority)
      CASE 
        WHEN user_city IS NOT NULL AND j.city = user_city THEN 1000
        WHEN user_state IS NOT NULL AND j.state = user_state THEN 800
        WHEN user_country IS NOT NULL AND j.country = user_country THEN 600
        ELSE 0
      END as location_score,
      
      -- Skills matching (secondary)
      CASE 
        WHEN user_skills IS NOT NULL THEN
          (SELECT COUNT(*) FROM unnest(j.skills) skill 
           WHERE skill = ANY(user_skills)) * 50
        ELSE 0
      END as skills_score,
      
      -- Language matching (tertiary)
      CASE 
        WHEN user_languages IS NOT NULL THEN
          (SELECT COUNT(*) FROM unnest(j.languages) lang 
           WHERE lang = ANY(user_languages)) * 30
        ELSE 0
      END as language_score,
      
      -- Country validation (mandatory if user has country)
      CASE 
        WHEN user_country IS NULL THEN 1
        WHEN j.country = user_country THEN 1 
        ELSE 0 
      END as country_valid,
      
      -- Match reason for UI display
      CASE 
        WHEN user_city IS NOT NULL AND j.city = user_city THEN 'City Match'
        WHEN user_state IS NOT NULL AND j.state = user_state THEN 'State Match'
        WHEN user_skills IS NOT NULL AND 
          (SELECT COUNT(*) FROM unnest(j.skills) skill WHERE skill = ANY(user_skills)) > 0 
          THEN 'Skills Match'
        WHEN user_languages IS NOT NULL AND 
          (SELECT COUNT(*) FROM unnest(j.languages) lang WHERE lang = ANY(user_languages)) > 0 
          THEN 'Language Match'
        WHEN user_country IS NOT NULL AND j.country = user_country THEN 'Country Match'
        ELSE 'Popular'
      END as match_reason
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'active' 
      AND j.visibility = 'public'
      AND c.account_status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM job_applications ja 
        WHERE ja.job_id = j.id AND ja.user_id = p_user_id
      )
  )
  SELECT 
    sj.job_id,
    sj.title,
    sj.company,
    sj.location,
    sj.job_type,
    sj.experience_level,
    sj.salary_range,
    sj.description,
    sj.category,
    sj.skills,
    sj.is_boosted,
    sj.boost_level,
    sj.created_at,
    sj.views_count,
    sj.applications_count,
    sj.logo_url,
    (sj.location_score + sj.skills_score + sj.language_score)::integer as match_score,
    sj.match_reason,
    sj.city,
    sj.state,
    sj.country,
    sj.languages,
    sj.is_verified,
    sj.verified_plan_end,
    sj.badge_color,
    sj.company_instagram_link,
    sj.company_facebook_link,
    sj.company_youtube_link,
    sj.company_linkedin_link
  FROM scored_jobs sj
  WHERE sj.country_valid = 1
  ORDER BY 
    sj.location_score DESC,
    sj.skills_score DESC,
    sj.language_score DESC,
    sj.views_count DESC,
    sj.applications_count DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Create latest jobs with location priority function
CREATE OR REPLACE FUNCTION public.get_latest_jobs_with_priority_v2(
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
  created_at timestamptz,
  views_count integer,
  applications_count integer,
  logo_url text,
  location_match text,
  effective_date timestamptz,
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
  company_linkedin_link text
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
  -- Get user location data
  IF p_user_id IS NOT NULL THEN
    SELECT p.city, p.state, p.country
    INTO user_city, user_state, user_country
    FROM profiles p
    WHERE p.user_id = p_user_id;
  END IF;

  RETURN QUERY
  WITH latest_jobs AS (
    SELECT 
      j.id as job_id,
      j.title,
      COALESCE(c.company_name, '') as company,
      j.location,
      j.job_type,
      j.experience_level,
      j.salary_range,
      j.description,
      j.category,
      j.skills,
      j.is_boosted,
      COALESCE(j.boost_level, 0) as boost_level,
      j.created_at,
      COALESCE(j.views_count, 0) as views_count,
      COALESCE(j.applications_count, 0) as applications_count,
      c.logo_url,
      j.city,
      j.state,
      j.country,
      j.languages,
      COALESCE(c.is_verified, false) as is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link as company_instagram_link,
      c.facebook_link as company_facebook_link,
      c.youtube_link as company_youtube_link,
      c.linkedin_link as company_linkedin_link,
      
      -- Location priority boost
      CASE 
        WHEN user_city IS NOT NULL AND j.city = user_city THEN 3
        WHEN user_state IS NOT NULL AND j.state = user_state THEN 2
        WHEN user_country IS NOT NULL AND j.country = user_country THEN 1
        ELSE 0
      END as location_priority,
      
      -- Effective date for sorting (boost recent jobs from user's location)
      j.created_at + (
        CASE 
          WHEN user_city IS NOT NULL AND j.city = user_city THEN INTERVAL '1095 days'
          WHEN user_state IS NOT NULL AND j.state = user_state THEN INTERVAL '730 days'
          WHEN user_country IS NOT NULL AND j.country = user_country THEN INTERVAL '365 days'
          ELSE INTERVAL '0 days'
        END
      ) as effective_date
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'active'
      AND j.visibility = 'public'
      AND c.account_status = 'active'
  )
  SELECT 
    lj.job_id,
    lj.title,
    lj.company,
    lj.location,
    lj.job_type,
    lj.experience_level,
    lj.salary_range,
    lj.description,
    lj.category,
    lj.skills,
    lj.is_boosted,
    lj.boost_level,
    lj.created_at,
    lj.views_count,
    lj.applications_count,
    lj.logo_url,
    CASE 
      WHEN lj.location_priority = 3 THEN 'city'
      WHEN lj.location_priority = 2 THEN 'state'
      WHEN lj.location_priority = 1 THEN 'country'
      ELSE NULL
    END as location_match,
    lj.effective_date,
    lj.city,
    lj.state,
    lj.country,
    lj.languages,
    lj.is_verified,
    lj.verified_plan_end,
    lj.badge_color,
    lj.company_instagram_link,
    lj.company_facebook_link,
    lj.company_youtube_link,
    lj.company_linkedin_link
  FROM latest_jobs lj
  ORDER BY lj.effective_date DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Create trending jobs with smart scoring function
CREATE OR REPLACE FUNCTION public.get_trending_jobs_optimized_v2(
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
  company_linkedin_link text
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
  -- Get user location data
  IF p_user_id IS NOT NULL THEN
    SELECT p.city, p.state, p.country
    INTO user_city, user_state, user_country
    FROM profiles p
    WHERE p.user_id = p_user_id;
  END IF;

  RETURN QUERY
  WITH trending_jobs AS (
    SELECT 
      j.id as job_id,
      j.title,
      COALESCE(c.company_name, '') as company,
      j.location,
      j.job_type,
      j.experience_level,
      j.salary_range,
      j.description,
      j.category,
      j.skills,
      j.is_boosted,
      COALESCE(j.boost_level, 0) as boost_level,
      j.created_at,
      COALESCE(j.views_count, 0) as views_count,
      COALESCE(j.applications_count, 0) as applications_count,
      c.logo_url,
      j.city,
      j.state,
      j.country,
      j.languages,
      COALESCE(c.is_verified, false) as is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link as company_instagram_link,
      c.facebook_link as company_facebook_link,
      c.youtube_link as company_youtube_link,
      c.linkedin_link as company_linkedin_link,
      
      -- Location priority
      CASE 
        WHEN user_city IS NOT NULL AND j.city = user_city THEN 3
        WHEN user_state IS NOT NULL AND j.state = user_state THEN 2
        WHEN user_country IS NOT NULL AND j.country = user_country THEN 1
        ELSE 0
      END as location_priority,
      
      -- Recency factor
      CASE 
        WHEN j.created_at > NOW() - INTERVAL '7 days' THEN 100
        WHEN j.created_at > NOW() - INTERVAL '30 days' THEN 50
        ELSE 0
      END as recency_factor,
      
      -- Enhanced trending score formula
      (
        (COALESCE(j.views_count, 0) * 0.5) + 
        (COALESCE(j.applications_count, 0) * 0.3) + 
        (CASE WHEN j.is_boosted THEN 100 ELSE 0 END) + 
        (COALESCE(j.boost_level, 0) * 20) +
        (CASE 
          WHEN j.created_at > NOW() - INTERVAL '7 days' THEN 100
          WHEN j.created_at > NOW() - INTERVAL '30 days' THEN 50
          ELSE 0
        END * 0.2) +
        (CASE 
          WHEN user_city IS NOT NULL AND j.city = user_city THEN 150
          WHEN user_state IS NOT NULL AND j.state = user_state THEN 100
          WHEN user_country IS NOT NULL AND j.country = user_country THEN 50
          ELSE 0
        END)
      ) as trending_score
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'active'
      AND j.visibility = 'public'
      AND c.account_status = 'active'
  )
  SELECT 
    tj.job_id,
    tj.title,
    tj.company,
    tj.location,
    tj.job_type,
    tj.experience_level,
    tj.salary_range,
    tj.description,
    tj.category,
    tj.skills,
    tj.is_boosted,
    tj.boost_level,
    tj.created_at,
    tj.views_count,
    tj.applications_count,
    tj.logo_url,
    tj.trending_score,
    CASE 
      WHEN tj.location_priority = 3 THEN 'city'
      WHEN tj.location_priority = 2 THEN 'state'
      WHEN tj.location_priority = 1 THEN 'country'
      ELSE NULL
    END as location_match,
    tj.city,
    tj.state,
    tj.country,
    tj.languages,
    tj.is_verified,
    tj.verified_plan_end,
    tj.badge_color,
    tj.company_instagram_link,
    tj.company_facebook_link,
    tj.company_youtube_link,
    tj.company_linkedin_link
  FROM trending_jobs tj
  ORDER BY 
    tj.is_boosted DESC,
    tj.location_priority DESC,
    tj.trending_score DESC,
    tj.views_count DESC,
    tj.applications_count DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;