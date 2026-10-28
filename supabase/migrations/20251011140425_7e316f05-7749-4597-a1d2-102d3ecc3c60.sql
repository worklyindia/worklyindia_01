-- Drop the existing function first
DROP FUNCTION IF EXISTS public.search_jobs_by_id(text);

-- Create the search_jobs_by_id function with city, state, country fields
CREATE FUNCTION public.search_jobs_by_id(search_term text)
RETURNS TABLE (
  id uuid,
  title text,
  company_name text,
  location text,
  job_type text,
  experience_level text,
  salary_range text,
  description text,
  requirements text,
  benefits text,
  skills text[],
  status text,
  category text,
  created_at timestamptz,
  trending_score numeric,
  views_count integer,
  applications_count integer,
  calls_count integer,
  shares_count integer,
  is_boosted boolean,
  boost_level integer,
  logo_url text,
  is_verified boolean,
  verified_plan_end timestamptz,
  badge_color text,
  company_instagram_link text,
  company_facebook_link text,
  company_youtube_link text,
  company_linkedin_link text,
  city text,
  state text,
  country text,
  latitude numeric,
  longitude numeric,
  precise_address text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    COALESCE(c.company_name, 'Unknown Company') as company_name,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_range,
    j.description,
    j.requirements,
    j.benefits,
    j.skills,
    j.status,
    j.category,
    j.created_at,
    j.trending_score,
    j.views_count,
    j.applications_count,
    j.calls_count,
    j.shares_count,
    j.is_boosted,
    j.boost_level,
    c.logo_url,
    COALESCE(c.is_verified, false) as is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link as company_instagram_link,
    c.facebook_link as company_facebook_link,
    c.youtube_link as company_youtube_link,
    c.linkedin_link as company_linkedin_link,
    j.city,
    j.state,
    j.country,
    j.latitude,
    j.longitude,
    j.precise_address
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
    AND (
      j.id::text ILIKE '%' || search_term || '%' OR
      j.short_id ILIKE '%' || search_term || '%'
    )
  ORDER BY j.created_at DESC
  LIMIT 50;
END;
$$;