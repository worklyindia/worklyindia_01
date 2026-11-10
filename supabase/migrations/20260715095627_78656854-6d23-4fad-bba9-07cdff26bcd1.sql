DROP FUNCTION IF EXISTS public.get_latest_jobs_with_priority_v2(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_latest_jobs_with_priority_v2(p_user_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(job_id text, short_id text, public_slug text, title text, company text, location text, job_type text, experience_level text, salary_range text, description text, category text, skills text[], is_boosted boolean, boost_level integer, created_at timestamp with time zone, views_count bigint, applications_count bigint, logo_url text, location_match text, effective_date timestamp with time zone, city text, state text, country text, languages text[], is_verified boolean, verified_plan_end timestamp with time zone, badge_color text, company_instagram_link text, company_facebook_link text, company_youtube_link text, company_linkedin_link text, latitude numeric, longitude numeric, precise_address text, trending_score numeric, base_score numeric, trending_rank integer, organic_rank integer, is_new boolean, api_company_name text, education_required text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT 
      j.id::TEXT as job_id,
      j.short_id::TEXT as short_id,
      j.public_slug::TEXT as public_slug,
      j.title,
      COALESCE(c.company_name, j.api_company_name, '') as company,
      COALESCE(j.location, c.location, concat_ws(', ', NULLIF(j.city,''), NULLIF(j.state,''), NULLIF(j.country,''))) as location,
      j.job_type,
      j.experience_level,
      j.salary_range,
      j.description,
      j.category,
      j.skills,
      j.is_boosted,
      COALESCE(j.boost_level, 0) as boost_level,
      j.created_at,
      j.views_count::BIGINT as views_count,
      j.applications_count::BIGINT as applications_count,
      c.logo_url,
      NULL::TEXT as location_match,
      j.created_at as effective_date,
      COALESCE(j.city, c.city) as city,
      COALESCE(j.state, c.state) as state,
      COALESCE(j.country, c.country) as country,
      j.languages,
      COALESCE(c.is_verified, false) as is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link as company_instagram_link,
      c.facebook_link as company_facebook_link,
      c.youtube_link as company_youtube_link,
      c.linkedin_link as company_linkedin_link,
      j.latitude::NUMERIC as latitude,
      j.longitude::NUMERIC as longitude,
      COALESCE(j.precise_address, c.registered_address) as precise_address,
      COALESCE(j.trending_score, 0) as trending_score,
      0::NUMERIC as base_score,
      j.trending_rank as trending_rank,
      j.organic_rank as organic_rank,
      (j.created_at > NOW() - INTERVAL '24 hours') as is_new,
      j.api_company_name,
      j.education_required
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'active'
      AND (j.visibility IS NULL OR j.visibility = 'public')
      AND (c.account_status IS NULL OR c.account_status = 'active')
    ORDER BY 
      j.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$;