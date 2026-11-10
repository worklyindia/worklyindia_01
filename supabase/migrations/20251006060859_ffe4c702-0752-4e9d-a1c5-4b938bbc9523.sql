-- Fix return type mismatch by dropping existing function, then recreating with correct signature for the app
DROP FUNCTION IF EXISTS public.get_latest_jobs_with_priority_v2(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_latest_jobs_with_priority_v2(
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
  precise_address text,
  trending_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    COALESCE(j.skills, '{}'::text[]) AS skills,
    COALESCE(j.is_boosted, false) AS is_boosted,
    COALESCE(j.boost_level, 0) AS boost_level,
    j.created_at,
    COALESCE(j.views_count, 0) AS views_count,
    COALESCE(j.applications_count, 0) AS applications_count,
    c.logo_url,
    NULL::text AS location_match,
    j.created_at AS effective_date,
    j.city,
    j.state,
    j.country,
    COALESCE(j.languages, '{}'::text[]) AS languages,
    COALESCE(c.is_verified, false) AS is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link,
    j.latitude,
    j.longitude,
    j.precise_address,
    COALESCE(j.trending_score, 0)::numeric AS trending_score
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY j.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;