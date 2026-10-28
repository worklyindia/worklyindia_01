-- Fix ambiguous user_id references in database functions

-- Drop and recreate get_all_website_users function with proper table qualifiers
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_all_website_users(
  p_search text DEFAULT '',
  p_location text DEFAULT '',
  p_industry text DEFAULT '',
  p_status text DEFAULT '',
  p_limit integer DEFAULT 10000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  phone text,
  location text,
  industry text,
  current_position text,
  company text,
  skills text[],
  profile_image_url text,
  bio text,
  education text,
  experience_years integer,
  experience_level integer,
  preferred_location text,
  job_type text,
  whatsapp_number text,
  instagram_link text,
  facebook_link text,
  youtube_link text,
  linkedin_link text,
  precise_address text,
  city text,
  state text,
  country text,
  postal_code text,
  languages text[],
  is_profile_complete boolean,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  total_applications integer,
  account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has admin role - FIX: properly qualify user_id
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
    COALESCE(p.industry, '') as industry,
    COALESCE(p.current_position, '') as current_position,
    COALESCE(p.company, '') as company,
    COALESCE(p.skills, ARRAY[]::text[]) as skills,
    COALESCE(p.profile_image_url, '') as profile_image_url,
    COALESCE(p.bio, '') as bio,
    COALESCE(p.education, '') as education,
    COALESCE(p.experience_years, 0) as experience_years,
    COALESCE(p.experience_level, 0) as experience_level,
    COALESCE(p.preferred_location, '') as preferred_location,
    COALESCE(p.job_type, '') as job_type,
    COALESCE(p.whatsapp_number, '') as whatsapp_number,
    COALESCE(p.instagram_link, '') as instagram_link,
    COALESCE(p.facebook_link, '') as facebook_link,
    COALESCE(p.youtube_link, '') as youtube_link,
    COALESCE(p.linkedin_link, '') as linkedin_link,
    COALESCE(p.precise_address, '') as precise_address,
    COALESCE(p.city, '') as city,
    COALESCE(p.state, '') as state,
    COALESCE(p.country, '') as country,
    COALESCE(p.postal_code, '') as postal_code,
    COALESCE(p.languages, ARRAY[]::text[]) as languages,
    COALESCE(p.is_profile_complete, false) as is_profile_complete,
    p.created_at,
    au.last_sign_in_at,
    COALESCE(
      (SELECT COUNT(*)::integer FROM job_applications ja WHERE ja.user_id = p.user_id), 
      0
    ) as total_applications,
    COALESCE(p.account_status, 'active') as account_status
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE 
    (p_search = '' OR (
      p.full_name ILIKE '%' || p_search || '%' OR
      au.email ILIKE '%' || p_search || '%' OR
      p.current_position ILIKE '%' || p_search || '%' OR
      p.company ILIKE '%' || p_search || '%'
    ))
    AND (p_location = '' OR p.location ILIKE '%' || p_location || '%')
    AND (p_industry = '' OR p.industry ILIKE '%' || p_industry || '%')
    AND (p_status = '' OR p_status = 'all' OR p.account_status = p_status)
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Drop and recreate admin_update_jobseeker_profile function with proper table qualifiers
DROP FUNCTION IF EXISTS public.admin_update_jobseeker_profile(uuid, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_update_jobseeker_profile(
  p_user_id uuid,
  p_full_name text,
  p_phone text,
  p_whatsapp_number text,
  p_precise_address text,
  p_city text,
  p_state text,
  p_country text,
  p_postal_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if caller is admin - FIX: properly qualify user_id
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update profiles table
  UPDATE public.profiles SET
    full_name = p_full_name,
    phone = p_phone,
    whatsapp_number = p_whatsapp_number,
    precise_address = p_precise_address,
    city = p_city,
    state = p_state,
    country = p_country,
    postal_code = p_postal_code,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- If no profile exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.profiles (
      user_id, full_name, phone, whatsapp_number, 
      precise_address, city, state, country, postal_code
    )
    VALUES (
      p_user_id, p_full_name, p_phone, p_whatsapp_number,
      p_precise_address, p_city, p_state, p_country, p_postal_code
    );
  END IF;
END;
$$;

-- Drop and recreate admin_update_user_status function with proper table qualifiers
DROP FUNCTION IF EXISTS public.admin_update_user_status(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_user_id uuid, 
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if caller is admin - FIX: properly qualify user_id
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Validate status
  IF p_status NOT IN ('active', 'banned', 'job_banned', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status. Must be active, banned, job_banned, or suspended.';
  END IF;

  -- Update profiles table with new status
  UPDATE public.profiles SET
    account_status = p_status,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- If no profile exists, create one with the status
  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, account_status)
    VALUES (p_user_id, p_status)
    ON CONFLICT (user_id) DO UPDATE SET
      account_status = p_status,
      updated_at = now();
  END IF;
END;
$$;