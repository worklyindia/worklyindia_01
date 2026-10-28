-- Add sort_by parameter to fuzzy_search_jobs function
DROP FUNCTION IF EXISTS public.fuzzy_search_jobs(text,text,text,text,integer,integer,text,integer,integer);

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
  sort_by text DEFAULT ''::text
)
RETURNS TABLE(
  id uuid, title text, company_name text, location text, job_type text, 
  experience_level text, salary_range text, description text, requirements text, 
  benefits text, skills text[], status text, category text, created_at timestamp with time zone, 
  trending_score numeric, views_count integer, applications_count integer, 
  calls_count integer, shares_count integer, is_boosted boolean, boost_level integer, 
  logo_url text, match_score integer, is_verified boolean, verified_plan_end timestamp with time zone, 
  badge_color text, company_instagram_link text, company_facebook_link text, 
  company_youtube_link text, company_linkedin_link text, city text, state text, country text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  location_parts text[];
  search_city text;
  search_state text;
  search_country text;
  order_clause text;
BEGIN
  -- Parse location string into city, state, country
  IF job_location != '' THEN
    location_parts := string_to_array(job_location, ',');
    search_city := TRIM(COALESCE(location_parts[1], ''));
    search_state := TRIM(COALESCE(location_parts[2], ''));
    search_country := TRIM(COALESCE(location_parts[3], ''));
  ELSE
    search_city := '';
    search_state := '';
    search_country := '';
  END IF;

  -- Build ORDER BY clause based on sort_by parameter
  order_clause := CASE
    WHEN sort_by = 'latest' THEN 'j.created_at DESC, j.is_boosted DESC'
    WHEN sort_by = 'salary_high' THEN 'j.salary_range DESC, j.is_boosted DESC'
    WHEN sort_by = 'salary_low' THEN 'j.salary_range ASC, j.is_boosted DESC'
    WHEN sort_by = 'experience' THEN 'j.experience_level DESC, j.is_boosted DESC'
    ELSE 'j.is_boosted DESC, match_score DESC, j.trending_score DESC, j.created_at DESC'
  END;

  RETURN QUERY EXECUTE format('
    SELECT 
      j.id,
      j.title,
      COALESCE(c.company_name, ''Company'') as company_name,
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
      (
        CASE 
          WHEN $1 = '''' THEN 100
          WHEN LOWER(j.title) = LOWER($1) THEN 100
          WHEN LOWER(j.title) LIKE LOWER(''%%'' || $1 || ''%%'') THEN 95
          WHEN LOWER(COALESCE(c.company_name, '''')) = LOWER($1) THEN 90
          WHEN LOWER(COALESCE(c.company_name, '''')) LIKE LOWER(''%%'' || $1 || ''%%'') THEN 85
          WHEN LOWER(j.category) = LOWER($1) THEN 80
          WHEN LOWER(j.category) LIKE LOWER(''%%'' || $1 || ''%%'') THEN 75
          WHEN EXISTS (
            SELECT 1 FROM unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) AS skill 
            WHERE LOWER(skill) LIKE LOWER(''%%'' || $1 || ''%%'')
          ) THEN 70
          WHEN j.description ILIKE ''%%'' || $1 || ''%%'' THEN 65
          WHEN j.requirements ILIKE ''%%'' || $1 || ''%%'' THEN 60
          ELSE 50
        END
      )::integer AS match_score,
      COALESCE(c.is_verified, false) as is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link as company_instagram_link,
      c.facebook_link as company_facebook_link,
      c.youtube_link as company_youtube_link,
      c.linkedin_link as company_linkedin_link,
      j.city,
      j.state,
      j.country
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE 
      j.status = ''active''
      AND j.visibility = ''public''
      AND c.account_status = ''active''
      AND (
        $1 = '''' OR (
          j.title ILIKE ''%%'' || $1 || ''%%'' OR
          COALESCE(c.company_name, '''') ILIKE ''%%'' || $1 || ''%%'' OR
          j.description ILIKE ''%%'' || $1 || ''%%'' OR
          j.category ILIKE ''%%'' || $1 || ''%%'' OR
          j.requirements ILIKE ''%%'' || $1 || ''%%'' OR
          EXISTS (
            SELECT 1 FROM unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) AS skill 
            WHERE skill ILIKE ''%%'' || $1 || ''%%''
          )
        )
      )
      AND (
        $2 = '''' OR (
          ($3 != '''' AND (
            LOWER(TRIM(COALESCE(j.city, ''''))) = LOWER($3) OR
            LOWER(TRIM(COALESCE(j.city, ''''))) LIKE LOWER($3 || '' %%'') OR
            j.location ILIKE ''%%'' || $3 || ''%%''
          )) OR
          ($3 = '''' AND $4 != '''' AND (
            LOWER(TRIM(COALESCE(j.state, ''''))) = LOWER($4) OR
            LOWER(TRIM(COALESCE(j.state, ''''))) LIKE LOWER($4 || '' %%'') OR
            j.location ILIKE ''%%'' || $4 || ''%%''
          )) OR
          ($3 = '''' AND $4 = '''' AND $5 != '''' AND (
            LOWER(TRIM(COALESCE(j.country, ''''))) = LOWER($5) OR
            LOWER(TRIM(COALESCE(j.country, ''''))) LIKE LOWER($5 || '' %%'') OR
            j.location ILIKE ''%%'' || $5 || ''%%''
          )) OR
          (j.location ILIKE ''%%'' || $2 || ''%%'')
        )
      )
      AND ($6 = '''' OR j.job_type = $6)
      AND ($7 = '''' OR j.experience_level = $7)
      AND ($8 = '''' OR j.category = $8)
    ORDER BY %s
    LIMIT $9
    OFFSET $10',
    order_clause
  )
  USING search_query, job_location, search_city, search_state, search_country, 
        job_type_filter, experience_filter, category_filter, page_size, page_offset;
END;
$$;