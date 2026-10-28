-- Drop and recreate get_recommended_jobs function with verification data
DROP FUNCTION IF EXISTS public.get_recommended_jobs(uuid);

CREATE OR REPLACE FUNCTION public.get_recommended_jobs(u_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(job_id uuid, title text, company text, location text, job_type text, experience_level text, salary_range text, description text, category text, skills text[], is_boosted boolean, boost_level integer, created_at timestamp with time zone, views_count integer, applications_count integer, logo_url text, score integer, is_verified boolean, verified_plan_end timestamp with time zone, badge_color text, company_instagram_link text, company_facebook_link text, company_youtube_link text, company_linkedin_link text)
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
      )::int AS score,
      -- Company verification fields
      COALESCE(c.is_verified, false) AS is_verified,
      c.verified_plan_end,
      c.badge_color,
      c.instagram_link AS company_instagram_link,
      c.facebook_link AS company_facebook_link,
      c.youtube_link AS company_youtube_link,
      c.linkedin_link AS company_linkedin_link
    FROM public.jobs j
    LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE j.status = 'active'
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
    )::int AS score,
    -- Company verification fields
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
  WHERE j.status = 'active'
  ORDER BY score DESC
  LIMIT 20;
END;
$function$