-- Fix RPC structure mismatch by recreating function with explicit casts
CREATE OR REPLACE FUNCTION public.get_all_website_users(
  p_search text DEFAULT ''::text,
  p_location text DEFAULT ''::text,
  p_industry text DEFAULT ''::text,
  p_status text DEFAULT ''::text,
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
  created_at timestamptz,
  last_sign_in_at timestamptz,
  total_applications integer,
  account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure only admins/owners can access
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id::uuid,
    COALESCE(p.full_name, '')::text,
    COALESCE(au.email, '')::text,
    COALESCE(p.phone, '')::text,
    COALESCE(p.location, '')::text,
    COALESCE(p.industry, '')::text,
    COALESCE(p.current_position, '')::text,
    COALESCE(p.company, '')::text,
    COALESCE(p.skills, ARRAY[]::text[])::text[],
    COALESCE(p.profile_image_url, '')::text,
    COALESCE(p.bio, '')::text,
    COALESCE(p.education, '')::text,
    COALESCE(p.experience_years, 0)::integer,
    COALESCE(p.experience_level, 0)::integer,
    COALESCE(p.preferred_location, '')::text,
    COALESCE(p.job_type, '')::text,
    COALESCE(p.whatsapp_number, '')::text,
    COALESCE(p.instagram_link, '')::text,
    COALESCE(p.facebook_link, '')::text,
    COALESCE(p.youtube_link, '')::text,
    COALESCE(p.linkedin_link, '')::text,
    COALESCE(p.precise_address, '')::text,
    COALESCE(p.city, '')::text,
    COALESCE(p.state, '')::text,
    COALESCE(p.country, '')::text,
    COALESCE(p.postal_code, '')::text,
    COALESCE(p.languages, ARRAY[]::text[])::text[],
    COALESCE(p.is_profile_complete, false)::boolean,
    p.created_at::timestamptz,
    au.last_sign_in_at::timestamptz,
    COALESCE((SELECT COUNT(*) FROM public.job_applications ja WHERE ja.user_id = p.user_id), 0)::integer,
    COALESCE(p.account_status, 'active')::text
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