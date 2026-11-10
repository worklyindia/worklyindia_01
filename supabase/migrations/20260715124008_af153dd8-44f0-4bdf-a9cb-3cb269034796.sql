DROP FUNCTION IF EXISTS public.fuzzy_search_jobs(text,text,text,text,integer,integer,text,integer,integer,text,text);

CREATE OR REPLACE FUNCTION public.fuzzy_search_jobs(
  search_query text DEFAULT ''::text,
  job_location text DEFAULT ''::text,
  job_type_filter text DEFAULT ''::text,
  experience_filter text DEFAULT ''::text,
  salary_min integer DEFAULT 0,
  salary_max integer DEFAULT 1000000,
  category_filter text DEFAULT ''::text,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0,
  sort_by text DEFAULT ''::text,
  languages_filter text DEFAULT ''::text
)
RETURNS TABLE(
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
  created_at timestamp with time zone,
  trending_score numeric,
  views_count bigint,
  applications_count bigint,
  calls_count bigint,
  shares_count bigint,
  is_boosted boolean,
  boost_level integer,
  logo_url text,
  match_score integer,
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
  education_required text,
  openings integer,
  short_id text,
  work_mode text,
  shift_timing text
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  category_array text[];
BEGIN
  IF category_filter != '' THEN
    category_array := string_to_array(category_filter, ',');
  END IF;

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
    CASE
      WHEN search_query = '' THEN 0
      WHEN j.title ILIKE '%' || search_query || '%' THEN 100
      WHEN j.description ILIKE '%' || search_query || '%' THEN 80
      WHEN EXISTS (SELECT 1 FROM unnest(j.skills) skill WHERE skill ILIKE '%' || search_query || '%') THEN 60
      ELSE 40
    END as match_score,
    c.is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link as company_instagram_link,
    c.facebook_link as company_facebook_link,
    c.youtube_link as company_youtube_link,
    c.linkedin_link as company_linkedin_link,
    j.city,
    j.state,
    j.country,
    j.languages,
    j.education_required,
    j.openings,
    j.short_id,
    j.work_mode,
    j.shift_timing
  FROM jobs j
  LEFT JOIN companies c ON j.company_id = c.id
  WHERE j.status = 'active'
    AND j.visibility = 'public'
    AND (search_query = '' OR
         j.title ILIKE '%' || search_query || '%' OR
         j.description ILIKE '%' || search_query || '%' OR
         EXISTS (SELECT 1 FROM unnest(j.skills) skill WHERE skill ILIKE '%' || search_query || '%'))
    AND (job_location = '' OR j.location ILIKE '%' || job_location || '%' OR j.city ILIKE '%' || job_location || '%' OR j.state ILIKE '%' || job_location || '%' OR j.country ILIKE '%' || job_location || '%')
    AND (job_type_filter = '' OR j.job_type = job_type_filter)
    AND (experience_filter = '' OR j.experience_level = experience_filter)
    AND (category_filter = '' OR j.category = ANY(category_array))
    AND (languages_filter = '' OR j.languages && string_to_array(languages_filter, ','))
  ORDER BY
    CASE
      WHEN sort_by = 'trending' THEN j.trending_score
      WHEN sort_by = 'salary_high' THEN COALESCE(NULLIF(regexp_replace(split_part(j.salary_range, '-', 2), '[^0-9]', '', 'g'), '')::numeric, 0)
      WHEN sort_by = 'salary_low' THEN COALESCE(NULLIF(regexp_replace(split_part(j.salary_range, '-', 1), '[^0-9]', '', 'g'), '')::numeric, 999999999)
      WHEN sort_by = 'experience' THEN COALESCE(NULLIF(regexp_replace(j.experience_level, '[^0-9]', '', 'g'), '')::numeric, 0)
      ELSE 0
    END DESC,
    j.is_boosted DESC,
    j.created_at DESC
  LIMIT page_size
  OFFSET page_offset;
END;
$$;