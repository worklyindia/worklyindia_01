-- Drop and recreate get_latest_jobs_with_priority_v2 with correct columns
DROP FUNCTION IF EXISTS public.get_latest_jobs_with_priority_v2(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_latest_jobs_with_priority_v2(
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  title text,
  company_id uuid,
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
  postal_code text,
  latitude numeric,
  longitude numeric,
  languages text[],
  posted_at timestamp with time zone,
  organic_rank integer,
  organic_score numeric,
  trending_rank integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
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
    j.trending_score,
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
    (
      COALESCE(j.trending_score, 0) * 2 +
      (CASE WHEN j.is_featured THEN 1000 ELSE 0 END) +
      (CASE WHEN j.is_boosted AND j.boost_end_date > NOW() THEN j.boost_level * 500 ELSE 0 END) +
      (EXTRACT(EPOCH FROM (NOW() - j.created_at)) / -3600)::INTEGER
    )::NUMERIC as priority_score,
    j.category,
    j.city,
    j.state,
    j.country,
    j.postal_code,
    j.latitude,
    j.longitude,
    j.languages,
    j.posted_at,
    j.organic_rank,
    j.organic_score,
    j.trending_rank
  FROM jobs j
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY priority_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- Drop and recreate get_personalized_jobs_v3 with correct columns
DROP FUNCTION IF EXISTS public.get_personalized_jobs_v3(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_personalized_jobs_v3(
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  title text,
  company_id uuid,
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
  relevance_score numeric,
  category text,
  city text,
  state text,
  country text,
  postal_code text,
  latitude numeric,
  longitude numeric,
  languages text[],
  posted_at timestamp with time zone,
  organic_rank integer,
  organic_score numeric,
  trending_rank integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
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
    j.trending_score,
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
    (
      COALESCE(j.trending_score, 0) +
      (CASE WHEN j.is_featured THEN 500 ELSE 0 END) +
      (CASE WHEN j.is_boosted AND j.boost_end_date > NOW() THEN j.boost_level * 200 ELSE 0 END)
    )::NUMERIC as relevance_score,
    j.category,
    j.city,
    j.state,
    j.country,
    j.postal_code,
    j.latitude,
    j.longitude,
    j.languages,
    j.posted_at,
    j.organic_rank,
    j.organic_score,
    j.trending_rank
  FROM jobs j
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY relevance_score DESC, j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- Drop and recreate get_trending_jobs_optimized_v2 with correct columns
DROP FUNCTION IF EXISTS public.get_trending_jobs_optimized_v2(integer, integer);

CREATE OR REPLACE FUNCTION public.get_trending_jobs_optimized_v2(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  title text,
  company_id uuid,
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
  category text,
  city text,
  state text,
  country text,
  postal_code text,
  latitude numeric,
  longitude numeric,
  languages text[],
  posted_at timestamp with time zone,
  organic_rank integer,
  organic_score numeric,
  trending_rank integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
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
    j.trending_score,
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
    j.category,
    j.city,
    j.state,
    j.country,
    j.postal_code,
    j.latitude,
    j.longitude,
    j.languages,
    j.posted_at,
    j.organic_rank,
    j.organic_score,
    j.trending_rank
  FROM jobs j
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY j.trending_score DESC NULLS LAST, j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;