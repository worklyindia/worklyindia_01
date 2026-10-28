-- Fix the get_all_jobseekers function to handle NULL values properly
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
    p.user_id,
    COALESCE(p.full_name, '') as full_name,
    COALESCE(au.email, '') as email,
    COALESCE(p.phone, '') as phone,
    COALESCE(p.location, '') as location,
    COALESCE(p.current_position, '') as current_position,
    COALESCE(p.company, '') as company,
    COALESCE(p.industry, '') as industry,
    COALESCE(p.bio, '') as bio,
    COALESCE(p.skills, ARRAY[]::text[]) as skills,
    COALESCE(p.languages, ARRAY[]::text[]) as languages,
    COALESCE(p.experience_years, 0) as experience_years,
    COALESCE(p.profile_image_url, '') as profile_image_url,
    COALESCE(p.is_profile_complete, false) as is_profile_complete,
    p.created_at,
    COALESCE(au.last_sign_in_at, p.created_at) as last_sign_in_at,  -- Use profile created_at as fallback
    COALESCE(
      (SELECT COUNT(*)::integer FROM job_applications ja WHERE ja.user_id = p.user_id), 
      0
    ) as total_applications
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

-- Create the missing get_total_jobseekers_count function
CREATE OR REPLACE FUNCTION public.get_total_jobseekers_count(
  p_search text DEFAULT ''::text,
  p_location text DEFAULT ''::text,
  p_industry text DEFAULT ''::text,
  p_status text DEFAULT 'all'::text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_count integer;
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT COUNT(*)::integer INTO total_count
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
         (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days')));

  RETURN COALESCE(total_count, 0);
END;
$function$;

-- Create missing admin functions for job seeker management
CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_user_id uuid,
  p_action text
)
RETURNS void
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

  -- For now, this is a placeholder - in the future could implement user suspension, etc.
  -- Currently just log the action
  RAISE NOTICE 'Admin action % performed on user %', p_action, p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_jobseeker_profile(
  p_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_current_position text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_skills text[] DEFAULT NULL,
  p_languages text[] DEFAULT NULL,
  p_experience_years integer DEFAULT NULL,
  p_preferred_location text DEFAULT NULL,
  p_job_type text DEFAULT NULL,
  p_whatsapp_number text DEFAULT NULL,
  p_instagram_link text DEFAULT NULL,
  p_facebook_link text DEFAULT NULL,
  p_youtube_link text DEFAULT NULL,
  p_linkedin_link text DEFAULT NULL,
  p_precise_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_postal_code text DEFAULT NULL
)
RETURNS void
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

  -- Update profile with provided values (NULL values are ignored)
  UPDATE public.profiles SET
    full_name = COALESCE(p_full_name, full_name),
    phone = COALESCE(p_phone, phone),
    location = COALESCE(p_location, location),
    current_position = COALESCE(p_current_position, current_position),
    company = COALESCE(p_company, company),
    industry = COALESCE(p_industry, industry),
    bio = COALESCE(p_bio, bio),
    skills = COALESCE(p_skills, skills),
    languages = COALESCE(p_languages, languages),
    experience_years = COALESCE(p_experience_years, experience_years),
    preferred_location = COALESCE(p_preferred_location, preferred_location),
    job_type = COALESCE(p_job_type, job_type),
    whatsapp_number = COALESCE(p_whatsapp_number, whatsapp_number),
    instagram_link = COALESCE(p_instagram_link, instagram_link),
    facebook_link = COALESCE(p_facebook_link, facebook_link),
    youtube_link = COALESCE(p_youtube_link, youtube_link),
    linkedin_link = COALESCE(p_linkedin_link, linkedin_link),
    precise_address = COALESCE(p_precise_address, precise_address),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    country = COALESCE(p_country, country),
    postal_code = COALESCE(p_postal_code, postal_code),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', p_user_id;
  END IF;
END;
$function$;