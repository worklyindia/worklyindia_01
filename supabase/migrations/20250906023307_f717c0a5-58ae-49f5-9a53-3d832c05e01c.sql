-- Update search_jobs function to respect visibility settings
CREATE OR REPLACE FUNCTION public.search_jobs(search_query text DEFAULT ''::text, job_location text DEFAULT ''::text, job_type_filter text DEFAULT ''::text, experience_filter text DEFAULT ''::text, salary_min integer DEFAULT 0, salary_max integer DEFAULT 1000000, category_filter text DEFAULT ''::text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, title text, company_name text, location text, job_type text, experience_level text, salary_range text, description text, requirements text, benefits text, skills text[], status text, category text, created_at timestamp with time zone, trending_score numeric, views_count integer, applications_count integer, calls_count integer, shares_count integer, is_boosted boolean, boost_level integer, logo_url text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.title,
        COALESCE(c.company_name, 'Company') as company_name,
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
        c.logo_url
    FROM public.jobs j
    LEFT JOIN public.companies c ON j.company_id = c.id
    WHERE j.status = 'active'
        AND j.visibility = 'public'  -- Only show public jobs in search
        AND (search_query = '' OR (
            j.title ILIKE '%' || search_query || '%' OR
            COALESCE(c.company_name, '') ILIKE '%' || search_query || '%' OR
            j.description ILIKE '%' || search_query || '%' OR
            j.category ILIKE '%' || search_query || '%' OR
            EXISTS (SELECT 1 FROM unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) AS skill WHERE skill ILIKE '%' || search_query || '%')
        ))
        AND (job_location = '' OR j.location ILIKE '%' || job_location || '%')
        AND (job_type_filter = '' OR j.job_type = job_type_filter)
        AND (experience_filter = '' OR j.experience_level = experience_filter)
        AND (category_filter = '' OR j.category = category_filter)
    ORDER BY 
        j.is_boosted DESC,
        j.trending_score DESC,
        j.created_at DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$function$

-- Update fuzzy_search_jobs function
CREATE OR REPLACE FUNCTION public.fuzzy_search_jobs(search_query text DEFAULT ''::text, job_location text DEFAULT ''::text, job_type_filter text DEFAULT ''::text, experience_filter text DEFAULT ''::text, salary_min integer DEFAULT 0, salary_max integer DEFAULT 1000000, category_filter text DEFAULT ''::text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, title text, company_name text, location text, job_type text, experience_level text, salary_range text, description text, requirements text, benefits text, skills text[], status text, category text, created_at timestamp with time zone, trending_score numeric, views_count integer, applications_count integer, calls_count integer, shares_count integer, is_boosted boolean, boost_level integer, logo_url text, match_score integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.title,
        COALESCE(c.company_name, 'Company') as company_name,
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
        -- Calculate match score for search (simplified without similarity function)
        (
          CASE 
            -- Empty search shows all jobs
            WHEN search_query = '' THEN 100
            -- Exact title matches get highest score
            WHEN LOWER(j.title) = LOWER(search_query) THEN 100
            WHEN LOWER(j.title) LIKE LOWER('%' || search_query || '%') THEN 95
            -- Company name matches
            WHEN LOWER(COALESCE(c.company_name, '')) = LOWER(search_query) THEN 90
            WHEN LOWER(COALESCE(c.company_name, '')) LIKE LOWER('%' || search_query || '%') THEN 85
            -- Category matches
            WHEN LOWER(j.category) = LOWER(search_query) THEN 80
            WHEN LOWER(j.category) LIKE LOWER('%' || search_query || '%') THEN 75
            -- Skills matching
            WHEN EXISTS (
              SELECT 1 FROM unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) AS skill 
              WHERE LOWER(skill) LIKE LOWER('%' || search_query || '%')
            ) THEN 70
            -- Description matching
            WHEN j.description ILIKE '%' || search_query || '%' THEN 65
            -- Requirements matching
            WHEN j.requirements ILIKE '%' || search_query || '%' THEN 60
            ELSE 50
          END
        )::integer AS match_score
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.status = 'active'
        AND j.visibility = 'public'  -- Only show public jobs in search
        AND (
          search_query = '' OR (
            -- Basic text search without similarity function
            j.title ILIKE '%' || search_query || '%' OR
            COALESCE(c.company_name, '') ILIKE '%' || search_query || '%' OR
            j.description ILIKE '%' || search_query || '%' OR
            j.category ILIKE '%' || search_query || '%' OR
            j.requirements ILIKE '%' || search_query || '%' OR
            EXISTS (
              SELECT 1 FROM unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) AS skill 
              WHERE skill ILIKE '%' || search_query || '%'
            )
          )
        )
        AND (job_location = '' OR j.location ILIKE '%' || job_location || '%')
        AND (job_type_filter = '' OR j.job_type = job_type_filter)
        AND (experience_filter = '' OR j.experience_level = experience_filter)
        AND (category_filter = '' OR j.category = category_filter)
    ORDER BY 
        j.is_boosted DESC,
        match_score DESC,
        j.trending_score DESC,
        j.created_at DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$function$

-- Update get_recommended_jobs function
CREATE OR REPLACE FUNCTION public.get_recommended_jobs(u_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(job_id uuid, title text, company text, location text, job_type text, experience_level text, salary_range text, description text, category text, skills text[], is_boosted boolean, boost_level integer, created_at timestamp with time zone, views_count integer, applications_count integer, logo_url text, score integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
BEGIN
  uid := COALESCE(u_id, auth.uid());

  -- If no auth and no user id provided, fallback to boosted/recent top jobs
  IF uid IS NULL THEN
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
      (
        (CASE WHEN j.is_boosted THEN 100 ELSE 0 END) +
        (CASE WHEN j.created_at > now() - interval '7 days' THEN 40 ELSE 0 END)
      )::int AS score
    FROM public.jobs j
    LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE j.status = 'active' AND j.visibility = 'public'  -- Only show public jobs
    ORDER BY j.is_boosted DESC, j.created_at DESC
    LIMIT 20;
    RETURN;
  END IF;

  RETURN QUERY
  WITH u AS (
    SELECT 
      p.user_id,
      COALESCE(p.skills, '{}'::text[]) AS skills,
      p.preferred_location,
      p.job_type,
      p.industry,
      COALESCE(p.experience_level, 0) AS experience_level
    FROM public.profiles p
    WHERE p.user_id = uid
    LIMIT 1
  )
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
    (
      -- location preference
      (CASE WHEN u.preferred_location IS NOT NULL AND j.location = u.preferred_location THEN 30 ELSE 0 END) +
      -- job type preference
      (CASE WHEN u.job_type IS NOT NULL AND j.job_type = u.job_type THEN 20 ELSE 0 END) +
      -- skills overlap (text[] && text[])
      (CASE WHEN (COALESCE(j.skills, '{}'::text[]) && u.skills) THEN 50 ELSE 0 END) +
      -- industry/category match
      (CASE WHEN u.industry IS NOT NULL AND j.category = u.industry THEN 15 ELSE 0 END) +
      -- experience match: user level >= job level
      (CASE 
        WHEN u.experience_level >= 
          (CASE 
            WHEN j.experience_level IS NULL THEN 0
            WHEN lower(j.experience_level) IN ('fresher','entry','0-1','0-1 years','0') THEN 0
            WHEN lower(j.experience_level) ~ '(1\\s*-\\s*3|junior)' THEN 1
            WHEN lower(j.experience_level) ~ '(3\\s*-\\s*5|mid)' THEN 2
            WHEN lower(j.experience_level) ~ '(5\\s*\\+|5\\s*-\\s*8|senior)' THEN 3
            ELSE 0
          END)
        THEN 10 ELSE 0 END) +
      -- boosted bonus
      (CASE WHEN j.is_boosted THEN 100 ELSE 0 END) +
      -- recency bonus
      (CASE WHEN j.created_at > now() - interval '7 days' THEN 40 ELSE 0 END)
    )::int AS score
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  LEFT JOIN u ON true
  WHERE j.status = 'active' AND j.visibility = 'public'  -- Only show public jobs
  ORDER BY score DESC
  LIMIT 20;
END;
$function$