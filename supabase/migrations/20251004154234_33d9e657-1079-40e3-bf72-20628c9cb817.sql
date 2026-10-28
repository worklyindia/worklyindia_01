-- Phase 1: Fix profiles table structure and RPC functions

-- 1. Ensure profiles table has all required location columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';

-- 2. Drop and recreate get_latest_jobs_with_priority function with correct return type
DROP FUNCTION IF EXISTS public.get_latest_jobs_with_priority(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_latest_jobs_with_priority(
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
  -- Get user's location if logged in
  IF p_user_id IS NOT NULL THEN
    SELECT p.city, p.state, COALESCE(p.country, 'India')
    INTO user_city, user_state, user_country
    FROM profiles p
    WHERE p.user_id = p_user_id;
  ELSE
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
    j.is_boosted,
    COALESCE(j.boost_level, 0) AS boost_level,
    j.created_at,
    COALESCE(j.views_count, 0) AS views_count,
    COALESCE(j.applications_count, 0) AS applications_count,
    c.logo_url,
    CASE
      WHEN j.city = user_city THEN 'city'
      WHEN j.state = user_state THEN 'state'
      WHEN j.country = user_country THEN 'country'
      ELSE NULL
    END AS location_match,
    -- Effective date with location priority boost
    CASE
      WHEN j.city = user_city THEN j.created_at + INTERVAL '30 days'
      WHEN j.state = user_state THEN j.created_at + INTERVAL '15 days'
      WHEN j.country = user_country THEN j.created_at + INTERVAL '7 days'
      ELSE j.created_at
    END AS effective_date,
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
    c.linkedin_link AS company_linkedin_link
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND c.account_status = 'active'
  ORDER BY 
    effective_date DESC,
    j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 3. Drop and recreate get_trending_jobs_optimized with correct return type
DROP FUNCTION IF EXISTS public.get_trending_jobs_optimized(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_trending_jobs_optimized(
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
  -- Get user's location if logged in
  IF p_user_id IS NOT NULL THEN
    SELECT p.city, p.state, COALESCE(p.country, 'India')
    INTO user_city, user_state, user_country
    FROM profiles p
    WHERE p.user_id = p_user_id;
  ELSE
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
    j.is_boosted,
    COALESCE(j.boost_level, 0) AS boost_level,
    j.created_at,
    COALESCE(j.views_count, 0) AS views_count,
    COALESCE(j.applications_count, 0) AS applications_count,
    c.logo_url,
    -- Trending score: boosted jobs first, then by location + popularity
    (
      (CASE WHEN j.is_boosted THEN 1000 ELSE 0 END) +
      (CASE WHEN j.city = user_city THEN 500 ELSE 0 END) +
      (CASE WHEN j.state = user_state THEN 300 ELSE 0 END) +
      (CASE WHEN j.country = user_country THEN 100 ELSE 0 END) +
      (COALESCE(j.views_count, 0) * 0.5) +
      (COALESCE(j.applications_count, 0) * 2)
    )::numeric AS trending_score,
    CASE
      WHEN j.city = user_city THEN 'city'
      WHEN j.state = user_state THEN 'state'
      WHEN j.country = user_country THEN 'country'
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
    c.linkedin_link AS company_linkedin_link
  FROM jobs j
  LEFT JOIN companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND c.account_status = 'active'
  ORDER BY trending_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(city, state, country) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_jobs_trending ON jobs(views_count, applications_count, is_boosted) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(city, state, country);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC) WHERE status = 'active';

-- 5. Add comment for documentation
COMMENT ON FUNCTION get_latest_jobs_with_priority IS 'Returns latest jobs with location-based priority: City > State > Country. Guest users default to India.';
COMMENT ON FUNCTION get_trending_jobs_optimized IS 'Returns trending jobs sorted by: Boosted first, then location match, then popularity (views + applies).';