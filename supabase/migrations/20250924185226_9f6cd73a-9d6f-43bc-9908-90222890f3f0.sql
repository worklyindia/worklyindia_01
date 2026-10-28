-- Fix fuzzy_search_jobs function to not filter by job_posting_visibility
-- job_posting_visibility should only affect NEW job posting, not existing job visibility

CREATE OR REPLACE FUNCTION public.fuzzy_search_jobs(
  search_query text DEFAULT ''::text, 
  job_location text DEFAULT ''::text, 
  job_type_filter text DEFAULT ''::text, 
  experience_filter text DEFAULT ''::text, 
  salary_min integer DEFAULT 0, 
  salary_max integer DEFAULT 1000000, 
  category_filter text DEFAULT ''::text, 
  page_size integer DEFAULT 20, 
  page_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, title text, company_name text, location text, job_type text, 
  experience_level text, salary_range text, description text, requirements text, 
  benefits text, skills text[], status text, category text, created_at timestamp with time zone, 
  trending_score numeric, views_count integer, applications_count integer, 
  calls_count integer, shares_count integer, is_boosted boolean, boost_level integer, 
  logo_url text, match_score integer, is_verified boolean, verified_plan_end timestamp with time zone, 
  badge_color text, company_instagram_link text, company_facebook_link text, 
  company_youtube_link text, company_linkedin_link text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    (
      CASE 
        WHEN search_query = '' THEN 100
        WHEN LOWER(j.title) = LOWER(search_query) THEN 100
        WHEN LOWER(j.title) LIKE LOWER('%' || search_query || '%') THEN 95
        WHEN LOWER(COALESCE(c.company_name, '')) = LOWER(search_query) THEN 90
        WHEN LOWER(COALESCE(c.company_name, '')) LIKE LOWER('%' || search_query || '%') THEN 85
        WHEN LOWER(j.category) = LOWER(search_query) THEN 80
        WHEN LOWER(j.category) LIKE LOWER('%' || search_query || '%') THEN 75
        WHEN EXISTS (
          SELECT 1 FROM unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) AS skill 
          WHERE LOWER(skill) LIKE LOWER('%' || search_query || '%')
        ) THEN 70
        WHEN j.description ILIKE '%' || search_query || '%' THEN 65
        WHEN j.requirements ILIKE '%' || search_query || '%' THEN 60
        ELSE 50
      END
    )::integer AS match_score,
    COALESCE(c.is_verified, false) as is_verified,
    c.verified_plan_end,
    c.badge_color,
    c.instagram_link as company_instagram_link,
    c.facebook_link as company_facebook_link,
    c.youtube_link as company_youtube_link,
    c.linkedin_link as company_linkedin_link
  FROM jobs j
  LEFT JOIN companies c ON j.company_id = c.id
  WHERE 
    -- Must be publicly visible and from active company
    j.status = 'active'
    AND j.visibility = 'public'
    AND c.account_status = 'active'
    -- REMOVED: job_posting_visibility check - this should only affect NEW posting, not existing jobs
    AND (
      search_query = '' OR (
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
$$;