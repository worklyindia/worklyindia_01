-- Check and fix the get_all_jobseekers function to ensure proper type matching
CREATE OR REPLACE FUNCTION public.get_all_jobseekers(
  p_search text DEFAULT ''::text, 
  p_location text DEFAULT ''::text, 
  p_industry text DEFAULT ''::text, 
  p_status text DEFAULT 'all'::text, 
  p_limit integer DEFAULT 20, 
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id text, 
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
  created_at text, 
  last_sign_in_at text, 
  total_applications integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id::text,
    COALESCE(p.full_name, '')::text as full_name,
    COALESCE(au.email, '')::text as email,
    COALESCE(p.phone, '')::text as phone,
    COALESCE(p.location, '')::text as location,
    COALESCE(p.current_position, '')::text as current_position,
    COALESCE(p.company, '')::text as company,
    COALESCE(p.industry, '')::text as industry,
    COALESCE(p.bio, '')::text as bio,
    COALESCE(p.skills, ARRAY[]::text[])::text[] as skills,
    COALESCE(p.languages, ARRAY[]::text[])::text[] as languages,
    COALESCE(p.experience_years, 0)::integer as experience_years,
    COALESCE(p.profile_image_url, '')::text as profile_image_url,
    COALESCE(p.is_profile_complete, false)::boolean as is_profile_complete,
    p.created_at::text,
    COALESCE(au.last_sign_in_at::text, p.created_at::text) as last_sign_in_at,
    COALESCE(
      (SELECT COUNT(*)::integer FROM job_applications ja WHERE ja.user_id = p.user_id), 
      0
    )::integer as total_applications
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE 
    (p_search = '' OR (
      p.full_name ILIKE '%' || p_search || '%' OR
      p.current_position ILIKE '%' || p_search || '%' OR
      au.email ILIKE '%' || p_search || '%'
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