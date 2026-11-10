-- Fix the get_all_website_users function structure to match TypeScript interface exactly
DROP FUNCTION IF EXISTS public.get_all_website_users();
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_all_website_users(
  p_search text DEFAULT ''::text, 
  p_location text DEFAULT ''::text, 
  p_industry text DEFAULT ''::text, 
  p_status text DEFAULT 'all'::text, 
  p_limit integer DEFAULT 20, 
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  account_status text,
  bio text,
  city text,
  company text,
  country text,
  created_at timestamp with time zone,
  current_position text,
  education text,
  email text,
  experience_level integer,
  experience_years integer,
  facebook_link text,
  full_name text,
  industry text,
  instagram_link text,
  is_profile_complete boolean,
  job_type text,
  languages text[],
  last_sign_in_at timestamp with time zone,
  linkedin_link text,
  location text,
  phone text,
  postal_code text,
  precise_address text,
  preferred_location text,
  profile_image_url text,
  skills text[],
  state text,
  total_applications integer,
  user_id uuid,
  whatsapp_number text,
  youtube_link text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required. Please log in to access this feature.' USING ERRCODE = 'AUTHZ';
  END IF;

  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Admin access required. You do not have permission to view user data.' USING ERRCODE = 'PERM1';
  END IF;

  RETURN QUERY
  SELECT 
    'active'::text as account_status,
    COALESCE(p.bio, '')::text as bio,
    COALESCE(p.city, '')::text as city,
    COALESCE(p.company, '')::text as company,
    COALESCE(p.country, '')::text as country,
    p.created_at::timestamp with time zone,
    COALESCE(p.current_position, '')::text as current_position,
    COALESCE(p.education, '')::text as education,
    COALESCE(au.email, '')::text as email,
    COALESCE(p.experience_level, 0)::integer as experience_level,
    COALESCE(p.experience_years, 0)::integer as experience_years,
    COALESCE(p.facebook_link, '')::text as facebook_link,
    COALESCE(p.full_name, '')::text as full_name,
    COALESCE(p.industry, '')::text as industry,
    COALESCE(p.instagram_link, '')::text as instagram_link,
    COALESCE(p.is_profile_complete, false)::boolean as is_profile_complete,
    COALESCE(p.job_type, '')::text as job_type,
    COALESCE(p.languages, ARRAY[]::text[])::text[] as languages,
    au.last_sign_in_at::timestamp with time zone,
    COALESCE(p.linkedin_link, '')::text as linkedin_link,
    COALESCE(p.location, '')::text as location,
    COALESCE(p.phone, '')::text as phone,
    COALESCE(p.postal_code, '')::text as postal_code,
    COALESCE(p.precise_address, '')::text as precise_address,
    COALESCE(p.preferred_location, '')::text as preferred_location,
    COALESCE(p.profile_image_url, '')::text as profile_image_url,
    COALESCE(p.skills, ARRAY[]::text[])::text[] as skills,
    COALESCE(p.state, '')::text as state,
    COALESCE(
      (SELECT COUNT(*)::integer FROM job_applications ja WHERE ja.user_id = p.user_id), 
      0
    )::integer as total_applications,
    p.user_id::uuid,
    COALESCE(p.whatsapp_number, '')::text as whatsapp_number,
    COALESCE(p.youtube_link, '')::text as youtube_link
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE 
    -- Search filter
    (p_search = '' OR p_search IS NULL OR (
      p.full_name ILIKE '%' || p_search || '%' OR
      COALESCE(au.email, '') ILIKE '%' || p_search || '%' OR
      p.current_position ILIKE '%' || p_search || '%' OR
      EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.skills, ARRAY[]::text[])) s
        WHERE s ILIKE '%' || p_search || '%'
      )
    ))
    -- Location filter
    AND (p_location = '' OR p_location IS NULL OR p.location ILIKE '%' || p_location || '%')
    -- Industry filter
    AND (p_industry = '' OR p_industry IS NULL OR p.industry ILIKE '%' || p_industry || '%')
    -- Status filter
    AND (p_status = 'all' OR p_status IS NULL OR 
      (p_status = 'active' AND au.last_sign_in_at > NOW() - INTERVAL '30 days') OR
      (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days')))
  ORDER BY p.created_at DESC
  LIMIT CASE WHEN p_limit > 0 THEN p_limit ELSE 20 END 
  OFFSET CASE WHEN p_offset >= 0 THEN p_offset ELSE 0 END;
END;
$function$;