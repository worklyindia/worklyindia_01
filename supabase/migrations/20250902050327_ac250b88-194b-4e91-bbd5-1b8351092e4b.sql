
-- 1) Add user preference fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS preferred_location text,
  ADD COLUMN IF NOT EXISTS job_type text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS experience_level integer;

-- 2) Add category field to jobs (to map against user industry)
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS category text;

-- 3) Create the recommendation RPC, adapted to your schema
-- - Uses profiles instead of users
-- - Joins companies for company_name
-- - Interprets jobs.experience_level (text) into a comparable tier
-- - Respects RLS: profiles are only visible for the caller
CREATE OR REPLACE FUNCTION public.get_recommended_jobs(u_id uuid DEFAULT NULL)
RETURNS TABLE (
  job_id uuid,
  title text,
  company text,
  score integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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
      (
        (CASE WHEN j.is_boosted THEN 100 ELSE 0 END) +
        (CASE WHEN j.created_at > now() - interval '7 days' THEN 40 ELSE 0 END)
      )::int AS score
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
  WHERE j.status = 'active'
  ORDER BY score DESC
  LIMIT 20;
END;
$function$;
