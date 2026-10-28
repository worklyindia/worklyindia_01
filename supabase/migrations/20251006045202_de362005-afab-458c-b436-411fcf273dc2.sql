-- Fix ambiguous column reference in get_latest_jobs_with_priority_v2
-- Explicitly qualify all column references to avoid ambiguity

CREATE OR REPLACE FUNCTION public.get_latest_jobs_with_priority_v2(
  p_user_id uuid, 
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
  location_match text, 
  effective_date timestamp with time zone, 
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
  latitude numeric, 
  longitude numeric, 
  precise_address text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_city TEXT;
  user_state TEXT;
  user_country TEXT;
BEGIN
  -- Get user location if provided
  IF p_user_id IS NOT NULL THEN
    SELECT p.city, p.state, p.country 
    INTO user_city, user_state, user_country
    FROM public.profiles p
    WHERE p.user_id = p_user_id;
  END IF;

  RETURN QUERY
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
    j.skills,  -- Explicitly from jobs table
    COALESCE(j.is_boosted, false) as is_boosted,
    COALESCE(j.boost_level, 0) as boost_level,
    j.created_at,
    COALESCE(j.views_count, 0) as views_count,
    COALESCE(j.applications_count, 0) as applications_count,
    c.logo_url,
    CASE 
      WHEN user_city IS NOT NULL AND j.city = user_city THEN 'city'
      WHEN user_state IS NOT NULL AND j.state = user_state THEN 'state'
      WHEN user_country IS NOT NULL AND j.country = user_country THEN 'country'
      ELSE NULL
    END as location_match,
    j.created_at as effective_date,
    j.city,
    j.state,
    j.country,
    j.languages,  -- Explicitly from jobs table
    COALESCE(c.is_verified, false) as is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link as company_instagram_link,
    c.facebook_link as company_facebook_link,
    c.youtube_link as company_youtube_link,
    c.linkedin_link as company_linkedin_link,
    j.latitude,
    j.longitude,
    j.precise_address
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND (c.account_status = 'active' OR c.account_status IS NULL)
    AND (j.expires_at IS NULL OR j.expires_at > NOW())
  ORDER BY 
    j.created_at DESC,  -- Newest jobs first (DESC = descending order)
    j.id DESC           -- Secondary sort for consistency
  LIMIT p_limit 
  OFFSET p_offset;
END;
$$;