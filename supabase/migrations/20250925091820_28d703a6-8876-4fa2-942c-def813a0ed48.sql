-- Fix job seeker RPCs with explicit type casts to eliminate result type mismatches
-- Function: get_all_jobseekers
CREATE OR REPLACE FUNCTION public.get_all_jobseekers(
  p_search text DEFAULT ''::text,
  p_location text DEFAULT ''::text,
  p_industry text DEFAULT ''::text,
  p_status text DEFAULT 'all'::text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  phone text,
  location text,
  current_position text,
  company text,
  industry text,
  bio text,
  skills text[],
  languages text[],
  experience_years integer,
  profile_image_url text,
  is_profile_complete boolean,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  total_applications integer,
  account_status text,
  account_status_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Ensure only admins/owners can call
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() AND au.role IN ('admin','owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id::uuid AS user_id,
    COALESCE(p.full_name, '')::text AS full_name,
    COALESCE(au.email, '')::text AS email,
    COALESCE(p.phone, '')::text AS phone,
    COALESCE(p.location, '')::text AS location,
    COALESCE(p.current_position, '')::text AS current_position,
    COALESCE(p.company, '')::text AS company,
    COALESCE(p.industry, '')::text AS industry,
    COALESCE(p.bio, '')::text AS bio,
    COALESCE(p.skills, ARRAY[]::text[])::text[] AS skills,
    COALESCE(p.languages, ARRAY[]::text[])::text[] AS languages,
    COALESCE(p.experience_years, 0)::integer AS experience_years,
    COALESCE(p.profile_image_url, '')::text AS profile_image_url,
    COALESCE(p.is_profile_complete, false)::boolean AS is_profile_complete,
    p.created_at::timestamptz AS created_at,
    au.last_sign_in_at::timestamptz AS last_sign_in_at,
    COALESCE((SELECT COUNT(*)::integer FROM public.job_applications ja WHERE ja.user_id = p.user_id), 0)::integer AS total_applications,
    COALESCE(p.account_status, 'active')::text AS account_status,
    COALESCE(p.account_status_reason, NULL)::text AS account_status_reason
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE 
    (p_search = '' OR (
      p.full_name ILIKE '%' || p_search || '%' OR
      au.email ILIKE '%' || p_search || '%' OR
      p.current_position ILIKE '%' || p_search || '%' OR
      EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.skills, ARRAY[]::text[])) s
        WHERE s ILIKE '%' || p_search || '%'
      )
    ))
    AND (p_location = '' OR p.location ILIKE '%' || p_location || '%')
    AND (p_industry = '' OR p.industry ILIKE '%' || p_industry || '%')
    AND (p_status = 'all' OR 
         (p_status = 'active' AND au.last_sign_in_at > NOW() - INTERVAL '30 days') OR
         (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days')))
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- Function: get_total_jobseekers_count
CREATE OR REPLACE FUNCTION public.get_total_jobseekers_count(
  p_search text DEFAULT ''::text,
  p_location text DEFAULT ''::text,
  p_industry text DEFAULT ''::text,
  p_status text DEFAULT 'all'::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Ensure only admins/owners can call
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() AND au.role IN ('admin','owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT COUNT(*)::integer INTO v_count
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE 
    (p_search = '' OR (
      p.full_name ILIKE '%' || p_search || '%' OR
      au.email ILIKE '%' || p_search || '%' OR
      p.current_position ILIKE '%' || p_search || '%' OR
      EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.skills, ARRAY[]::text[])) s
        WHERE s ILIKE '%' || p_search || '%'
      )
    ))
    AND (p_location = '' OR p.location ILIKE '%' || p_location || '%')
    AND (p_industry = '' OR p.industry ILIKE '%' || p_industry || '%')
    AND (p_status = 'all' OR 
         (p_status = 'active' AND au.last_sign_in_at > NOW() - INTERVAL '30 days') OR
         (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days')));

  RETURN COALESCE(v_count, 0);
END;
$function$;