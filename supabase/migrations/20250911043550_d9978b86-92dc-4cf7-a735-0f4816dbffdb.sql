-- Update get_recommended_jobs function to filter banned companies
CREATE OR REPLACE FUNCTION public.get_recommended_jobs(u_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(job_id uuid, title text, company text, location text, job_type text, experience_level text, salary_range text, description text, category text, skills text[], is_boosted boolean, boost_level integer, created_at timestamp with time zone, views_count integer, applications_count integer, logo_url text, score integer, is_verified boolean, verified_plan_end timestamp with time zone, badge_color text, company_instagram_link text, company_facebook_link text, company_youtube_link text, company_linkedin_link text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
BEGIN
  uid := COALESCE(u_id, auth.uid());

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
      )::int AS score,
      COALESCE(c.is_verified, false) AS is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link AS company_instagram_link,
      c.facebook_link AS company_facebook_link,
      c.youtube_link AS company_youtube_link,
      c.linkedin_link AS company_linkedin_link
    FROM public.jobs j
    LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE 
      j.status = 'active'
      AND j.visibility = 'public'
      AND c.account_status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.employer_settings es 
        WHERE es.user_id = c.user_id 
          AND es.job_posting_visibility = true
      )
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
      (CASE WHEN u.preferred_location IS NOT NULL AND j.location = u.preferred_location THEN 30 ELSE 0 END) +
      (CASE WHEN u.job_type IS NOT NULL AND j.job_type = u.job_type THEN 20 ELSE 0 END) +
      (CASE WHEN (COALESCE(j.skills, '{}'::text[]) && u.skills) THEN 50 ELSE 0 END) +
      (CASE WHEN u.industry IS NOT NULL AND j.category = u.industry THEN 15 ELSE 0 END) +
      (CASE 
        WHEN u.experience_level >= 
          (CASE 
            WHEN j.experience_level IS NULL THEN 0
            WHEN lower(j.experience_level) IN ('fresher','entry','0-1','0-1 years','0') THEN 0
            WHEN lower(j.experience_level) ~ '(1\s*-\s*3|junior)' THEN 1
            WHEN lower(j.experience_level) ~ '(3\s*-\s*5|mid)' THEN 2
            WHEN lower(j.experience_level) ~ '(5\s*\+|5\s*-\s*8|senior)' THEN 3
            ELSE 0
          END)
        THEN 10 ELSE 0 END) +
      (CASE WHEN j.is_boosted THEN 100 ELSE 0 END) +
      (CASE WHEN j.created_at > now() - interval '7 days' THEN 40 ELSE 0 END)
    )::int AS score,
    COALESCE(c.is_verified, false) AS is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link AS company_instagram_link,
    c.facebook_link AS company_facebook_link,
    c.youtube_link AS company_youtube_link,
    c.linkedin_link AS company_linkedin_link
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  LEFT JOIN u ON true
  WHERE 
    j.status = 'active'
    AND j.visibility = 'public'
    AND c.account_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.employer_settings es 
      WHERE es.user_id = c.user_id 
        AND es.job_posting_visibility = true
    )
  ORDER BY score DESC
  LIMIT 20;
END;
$function$;

-- Update search_jobs function to filter banned companies
CREATE OR REPLACE FUNCTION public.search_jobs(search_query text DEFAULT ''::text, job_location text DEFAULT ''::text, job_type_filter text DEFAULT ''::text, experience_filter text DEFAULT ''::text, salary_min integer DEFAULT 0, salary_max integer DEFAULT 1000000, category_filter text DEFAULT ''::text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, title text, company_name text, location text, job_type text, experience_level text, salary_range text, description text, requirements text, benefits text, skills text[], status text, category text, created_at timestamp with time zone, trending_score numeric, views_count integer, applications_count integer, calls_count integer, shares_count integer, is_boosted boolean, boost_level integer, logo_url text)
 LANGUAGE plpgsql
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
        AND c.account_status = 'active'
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
$function$;

-- Update get_search_suggestions function to filter banned companies
CREATE OR REPLACE FUNCTION public.get_search_suggestions(query_text text, limit_count integer DEFAULT 10)
 RETURNS TABLE(suggestion text, type text, count integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH job_titles AS (
        SELECT DISTINCT j.title as suggestion, 'job_title' as type, COUNT(*)::INTEGER as count
        FROM public.jobs j
        LEFT JOIN public.companies c ON j.company_id = c.id
        WHERE j.status = 'active' AND c.account_status = 'active' AND j.title ILIKE '%' || query_text || '%'
        GROUP BY j.title
    ),
    companies AS (
        SELECT DISTINCT c.company_name as suggestion, 'company' as type, COUNT(*)::INTEGER as count
        FROM public.companies c
        JOIN public.jobs j ON j.company_id = c.id
        WHERE j.status = 'active' AND c.account_status = 'active' AND c.company_name ILIKE '%' || query_text || '%'
        GROUP BY c.company_name
    ),
    skills AS (
        SELECT DISTINCT skill as suggestion, 'skill' as type, COUNT(*)::INTEGER as count
        FROM public.jobs j
        LEFT JOIN public.companies c ON j.company_id = c.id, 
        unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) as skill
        WHERE j.status = 'active' AND c.account_status = 'active' AND skill ILIKE '%' || query_text || '%'
        GROUP BY skill
    ),
    categories AS (
        SELECT DISTINCT j.category as suggestion, 'category' as type, COUNT(*)::INTEGER as count
        FROM public.jobs j
        LEFT JOIN public.companies c ON j.company_id = c.id
        WHERE j.status = 'active' AND c.account_status = 'active' AND j.category ILIKE '%' || query_text || '%'
        GROUP BY j.category
    )
    SELECT * FROM job_titles
    UNION ALL
    SELECT * FROM companies
    UNION ALL
    SELECT * FROM skills
    UNION ALL
    SELECT * FROM categories
    ORDER BY count DESC, suggestion
    LIMIT limit_count;
END;
$function$;

-- Update get_job_categories_stats function to filter banned companies
CREATE OR REPLACE FUNCTION public.get_job_categories_stats()
 RETURNS TABLE(category text, job_count bigint, growth_percentage integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        j.category,
        COUNT(*) as job_count,
        -- Calculate growth based on jobs posted in last 30 days vs previous 30 days
        (
            CASE 
                WHEN COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '60 days' AND j.created_at < NOW() - INTERVAL '30 days' THEN 1 END) = 0 
                THEN 100
                ELSE (
                    (COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::FLOAT / 
                     NULLIF(COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '60 days' AND j.created_at < NOW() - INTERVAL '30 days' THEN 1 END), 0) - 1) * 100
                )::INTEGER
            END
        ) as growth_percentage
    FROM public.jobs j
    LEFT JOIN public.companies c ON j.company_id = c.id
    WHERE j.status = 'active' AND c.account_status = 'active'
    GROUP BY j.category
    HAVING COUNT(*) > 0
    ORDER BY job_count DESC;
END;
$function$;