
CREATE OR REPLACE FUNCTION public.get_latest_jobs_with_priority_v2(
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  job_id text, short_id text, public_slug text, title text, company text, location text,
  job_type text, experience_level text, salary_range text, description text, category text,
  skills text[], is_boosted boolean, boost_level integer, created_at timestamp with time zone,
  views_count bigint, applications_count bigint, logo_url text, location_match text,
  effective_date timestamp with time zone, city text, state text, country text, languages text[],
  is_verified boolean, verified_plan_end timestamp with time zone, badge_color text,
  company_instagram_link text, company_facebook_link text, company_youtube_link text,
  company_linkedin_link text, latitude numeric, longitude numeric, precise_address text,
  trending_score numeric, base_score numeric, trending_rank integer, organic_rank integer,
  is_new boolean, api_company_name text, education_required text, openings integer,
  work_mode text, shift_timing text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
    SELECT
      j.id::TEXT,
      j.short_id,
      j.public_slug,
      j.title,
      COALESCE(c.company_name, '')::text,
      COALESCE(j.location, c.location, concat_ws(', ', NULLIF(j.city,''), NULLIF(j.state,''), NULLIF(j.country,'')))::text,
      j.job_type, j.experience_level, j.salary_range, j.description, j.category, j.skills,
      j.is_boosted, COALESCE(j.boost_level, 0),
      j.created_at,
      j.views_count::BIGINT, j.applications_count::BIGINT,
      c.logo_url, NULL::TEXT,
      j.created_at,
      COALESCE(j.city, c.city), COALESCE(j.state, c.state), COALESCE(j.country, c.country),
      j.languages,
      COALESCE(c.is_verified, false), c.verified_plan_end, c.badge_color,
      c.instagram_link, c.facebook_link, c.youtube_link, c.linkedin_link,
      j.latitude, j.longitude,
      COALESCE(j.precise_address, c.registered_address),
      COALESCE(j.trending_score, 0), 0::NUMERIC, j.trending_rank, j.organic_rank,
      (j.created_at > NOW() - INTERVAL '24 hours'),
      j.api_company_name, j.education_required, j.openings,
      j.work_mode, j.shift_timing
    FROM jobs j
    LEFT JOIN companies c ON c.id = j.company_id
    WHERE j.status = 'active'
      AND (j.visibility IS NULL OR j.visibility = 'public')
    ORDER BY j.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$function$;
