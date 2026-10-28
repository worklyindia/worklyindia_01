CREATE OR REPLACE FUNCTION public.fuzzy_search_jobs(search_query text DEFAULT ''::text, job_location text DEFAULT ''::text, job_type_filter text DEFAULT ''::text, experience_filter text DEFAULT ''::text, salary_min integer DEFAULT 0, salary_max integer DEFAULT 1000000, category_filter text DEFAULT ''::text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0, sort_by text DEFAULT ''::text, languages_filter text DEFAULT ''::text)
 RETURNS TABLE(id uuid, title text, company_name text, location text, job_type text, experience_level text, salary_range text, description text, requirements text, benefits text, skills text[], status text, category text, created_at timestamp with time zone, trending_score numeric, views_count bigint, applications_count bigint, calls_count bigint, shares_count bigint, is_boosted boolean, boost_level integer, logo_url text, match_score integer, is_verified boolean, verified_plan_end timestamp with time zone, badge_color text, company_instagram_link text, company_facebook_link text, company_youtube_link text, company_linkedin_link text, city text, state text, country text, languages text[], education_required text, openings integer, short_id text, work_mode text, shift_timing text, organic_rank integer, trending_rank integer, public_slug text, organic_score numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  category_array text[];
  raw_terms text[];
  terms text[];
  term text;
  normalized_query text;
BEGIN
  IF category_filter != '' THEN
    category_array := string_to_array(category_filter, ',');
  END IF;

  -- Normalize the query and split into meaningful terms (words of 2+ chars)
  normalized_query := lower(trim(regexp_replace(coalesce(search_query, ''), '[^a-zA-Z0-9 ]', ' ', 'g')));
  raw_terms := array(
    SELECT w FROM unnest(string_to_array(normalized_query, ' ')) AS w
    WHERE length(w) >= 2
  );

  -- Smart synonym expansion (AI-like understanding without AI)
  terms := raw_terms;
  FOREACH term IN ARRAY raw_terms LOOP
    CASE term
      WHEN 'wfh' THEN terms := terms || ARRAY['remote','home'];
      WHEN 'workfromhome' THEN terms := terms || ARRAY['remote','home'];
      WHEN 'fresher' THEN terms := terms || ARRAY['entry','freshers'];
      WHEN 'freshers' THEN terms := terms || ARRAY['fresher','entry'];
      WHEN 'developer' THEN terms := terms || ARRAY['engineer'];
      WHEN 'engineer' THEN terms := terms || ARRAY['developer'];
      WHEN 'coder' THEN terms := terms || ARRAY['developer','programmer'];
      WHEN 'programmer' THEN terms := terms || ARRAY['developer','coder'];
      WHEN 'teacher' THEN terms := terms || ARRAY['tutor','teaching'];
      WHEN 'tutor' THEN terms := terms || ARRAY['teacher','teaching'];
      WHEN 'designer' THEN terms := terms || ARRAY['design'];
      WHEN 'writer' THEN terms := terms || ARRAY['writing','content'];
      WHEN 'typist' THEN terms := terms || ARRAY['typing'];
      WHEN 'driver' THEN terms := terms || ARRAY['driving'];
      WHEN 'salesman' THEN terms := terms || ARRAY['sales'];
      WHEN 'parttime' THEN terms := terms || ARRAY['part'];
      WHEN 'fulltime' THEN terms := terms || ARRAY['full'];
      ELSE NULL;
    END CASE;
  END LOOP;

  RETURN QUERY
  WITH matched AS (
    SELECT
      j.id,
      j.title,
      COALESCE(c.company_name, 'Unknown Company') AS company_name,
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
      COALESCE(j.views_count, 0)::bigint AS views_count,
      COALESCE(j.applications_count, 0)::bigint AS applications_count,
      COALESCE(j.calls_count, 0)::bigint AS calls_count,
      COALESCE(j.shares_count, 0)::bigint AS shares_count,
      j.is_boosted,
      j.boost_level,
      c.logo_url,
      c.is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link AS company_instagram_link,
      c.facebook_link AS company_facebook_link,
      c.youtube_link AS company_youtube_link,
      c.linkedin_link AS company_linkedin_link,
      j.city,
      j.state,
      j.country,
      j.languages,
      j.education_required,
      j.openings,
      j.short_id,
      j.work_mode,
      j.shift_timing,
      j.organic_rank,
      j.trending_rank,
      j.public_slug,
      j.organic_score,
      -- AI-like relevance score
      CASE
        WHEN search_query = '' OR search_query IS NULL THEN 0
        -- Exact phrase in title: strongest match
        WHEN lower(j.title) LIKE '%' || normalized_query || '%' THEN 100
        -- Every query term appears in the title
        WHEN cardinality(raw_terms) > 0 AND NOT EXISTS (
          SELECT 1 FROM unnest(raw_terms) rt
          WHERE lower(j.title) NOT LIKE '%' || rt || '%'
        ) THEN 90
        -- Any term in title (with typo tolerance)
        WHEN EXISTS (
          SELECT 1 FROM unnest(terms) t
          WHERE lower(j.title) LIKE '%' || t || '%'
             OR similarity(lower(j.title), t) > 0.25
        ) THEN 75
        -- Term matches a skill
        WHEN EXISTS (
          SELECT 1 FROM unnest(terms) t
          WHERE EXISTS (
            SELECT 1 FROM unnest(j.skills) skill
            WHERE lower(skill) LIKE '%' || t || '%' OR similarity(lower(skill), t) > 0.3
          )
        ) THEN 60
        -- Term matches company name
        WHEN EXISTS (
          SELECT 1 FROM unnest(terms) t
          WHERE lower(COALESCE(c.company_name,'')) LIKE '%' || t || '%'
        ) THEN 55
        -- Term matches description or category
        WHEN EXISTS (
          SELECT 1 FROM unnest(terms) t
          WHERE lower(COALESCE(j.description,'')) LIKE '%' || t || '%'
             OR lower(COALESCE(j.category,'')) LIKE '%' || t || '%'
        ) THEN 40
        -- Typo-tolerant fallback on full text
        WHEN similarity(lower(j.title || ' ' || COALESCE(j.description,'')), normalized_query) > 0.08 THEN 25
        ELSE 0
      END AS match_score
    FROM jobs j
    LEFT JOIN companies c ON j.company_id = c.id
    WHERE j.status = 'active'
      AND j.visibility = 'public'
      AND (
        search_query = '' OR search_query IS NULL OR cardinality(raw_terms) = 0 OR
        lower(j.title) LIKE '%' || normalized_query || '%' OR
        EXISTS (
          SELECT 1 FROM unnest(terms) t
          WHERE lower(j.title) LIKE '%' || t || '%'
             OR lower(COALESCE(j.description,'')) LIKE '%' || t || '%'
             OR lower(COALESCE(c.company_name,'')) LIKE '%' || t || '%'
             OR lower(COALESCE(j.category,'')) LIKE '%' || t || '%'
             OR lower(COALESCE(j.location,'')) LIKE '%' || t || '%'
             OR lower(COALESCE(j.city,'')) LIKE '%' || t || '%'
             OR similarity(lower(j.title), t) > 0.25
             OR EXISTS (
               SELECT 1 FROM unnest(j.skills) skill
               WHERE lower(skill) LIKE '%' || t || '%' OR similarity(lower(skill), t) > 0.3
             )
        )
      )
      AND (job_location = '' OR j.location ILIKE '%' || job_location || '%' OR j.city ILIKE '%' || job_location || '%' OR j.state ILIKE '%' || job_location || '%' OR j.country ILIKE '%' || job_location || '%')
      AND (job_type_filter = '' OR j.job_type = job_type_filter)
      AND (experience_filter = '' OR j.experience_level = experience_filter)
      AND (category_filter = '' OR j.category = ANY(category_array))
      AND (languages_filter = '' OR j.languages && string_to_array(languages_filter, ','))
  )
  SELECT
    m.id, m.title, m.company_name, m.location, m.job_type, m.experience_level,
    m.salary_range, m.description, m.requirements, m.benefits, m.skills, m.status,
    m.category, m.created_at, m.trending_score, m.views_count, m.applications_count,
    m.calls_count, m.shares_count, m.is_boosted, m.boost_level, m.logo_url,
    m.match_score, m.is_verified, m.verified_plan_end, m.badge_color,
    m.company_instagram_link, m.company_facebook_link, m.company_youtube_link,
    m.company_linkedin_link, m.city, m.state, m.country, m.languages,
    m.education_required, m.openings, m.short_id, m.work_mode, m.shift_timing,
    m.organic_rank, m.trending_rank, m.public_slug, m.organic_score
  FROM matched m
  WHERE m.match_score > 0 OR search_query = '' OR search_query IS NULL OR cardinality(raw_terms) = 0
  ORDER BY
    -- Searched results always on top, best relevance first
    m.match_score DESC,
    CASE
      WHEN sort_by = 'trending' THEN m.trending_score
      WHEN sort_by = 'salary_high' THEN COALESCE(NULLIF(regexp_replace(split_part(m.salary_range, '-', 2), '[^0-9]', '', 'g'), '')::numeric, 0)
      WHEN sort_by = 'salary_low' THEN COALESCE(NULLIF(regexp_replace(split_part(m.salary_range, '-', 1), '[^0-9]', '', 'g'), '')::numeric, 999999999)
      WHEN sort_by = 'experience' THEN COALESCE(NULLIF(regexp_replace(m.experience_level, '[^0-9]', '', 'g'), '')::numeric, 0)
      ELSE 0
    END DESC,
    m.is_boosted DESC,
    m.created_at DESC
  LIMIT page_size
  OFFSET page_offset;
END;
$function$