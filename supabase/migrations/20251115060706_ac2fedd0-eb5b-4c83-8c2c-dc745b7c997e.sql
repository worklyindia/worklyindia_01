-- Recreate get_latest_jobs_with_priority_v2 to ensure all old jobs are shown
-- Sort by created_at DESC (newest first, oldest last)

DROP FUNCTION IF EXISTS public.get_latest_jobs_with_priority_v2(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_latest_jobs_with_priority_v2(
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  job_id uuid,
  title text,
  company_id uuid,
  company text,
  logo_url text,
  location text,
  salary_min integer,
  salary_max integer,
  salary_currency text,
  salary_period text,
  salary_range text,
  job_type text,
  experience_level text,
  description text,
  requirements text,
  responsibilities text[],
  skills text[],
  benefits text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  status text,
  visibility text,
  trending_score integer,
  views_count bigint,
  applications_count bigint,
  calls_count integer,
  shares_count integer,
  is_featured boolean,
  is_boosted boolean,
  boost_level integer,
  boost_end_date timestamp with time zone,
  boost_bonus_applied integer,
  api_company_name text,
  priority_score numeric,
  category text,
  city text,
  state text,
  country text,
  latitude numeric,
  longitude numeric,
  languages text[],
  organic_rank integer,
  organic_score numeric,
  trending_rank integer,
  is_verified boolean,
  verified_plan_end timestamp with time zone,
  badge_color text,
  company_instagram_link text,
  company_facebook_link text,
  company_youtube_link text,
  company_linkedin_link text,
  precise_address text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.id as job_id,
    j.title,
    j.company_id,
    COALESCE(c.company_name, j.api_company_name, 'Unknown Company') as company,
    c.logo_url,
    j.location,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.salary_period,
    j.salary_range,
    j.job_type,
    j.experience_level,
    j.description,
    j.requirements,
    j.responsibilities,
    j.skills,
    j.benefits,
    j.expires_at,
    j.created_at,
    j.updated_at,
    j.status,
    j.visibility,
    j.trending_score::integer,
    j.views_count::bigint,
    j.applications_count::bigint,
    j.calls_count,
    j.shares_count,
    j.is_featured,
    j.is_boosted,
    j.boost_level,
    j.boost_end_date,
    j.boost_bonus_applied,
    j.api_company_name,
    0::NUMERIC as priority_score,
    j.category,
    j.city,
    j.state,
    j.country,
    j.latitude,
    j.longitude,
    j.languages,
    j.organic_rank,
    j.organic_score,
    j.trending_rank,
    COALESCE(c.is_verified, false) as is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link as company_instagram_link,
    c.facebook_link as company_facebook_link,
    c.youtube_link as company_youtube_link,
    c.linkedin_link as company_linkedin_link,
    j.precise_address
  FROM jobs j
  LEFT JOIN companies c ON j.company_id = c.id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
    AND (c.account_status IS NULL OR c.account_status = 'active')
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;