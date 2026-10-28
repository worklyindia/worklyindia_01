-- Harmonize admin check to use is_admin(auth.uid())
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
  -- Ensure only admins/owners can access using canonical helper
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    COALESCE(p.full_name, '') AS full_name,
    COALESCE(au.email, '') AS email,
    COALESCE(p.phone, '') AS phone,
    COALESCE(p.location, '') AS location,
    COALESCE(p.industry, '') AS industry,
    COALESCE(p.current_position, '') AS current_position,
    COALESCE(p.company, '') AS company,
    COALESCE(p.skills, ARRAY[]::text[]) AS skills,
    COALESCE(p.profile_image_url, '') AS profile_image_url,
    COALESCE(p.bio, '') AS bio,
    COALESCE(p.education, '') AS education,
    COALESCE(p.experience_years, 0) AS experience_years,
    COALESCE(p.experience_level, 0) AS experience_level,
    COALESCE(p.preferred_location, '') AS preferred_location,
    COALESCE(p.job_type, '') AS job_type,
    COALESCE(p.whatsapp_number, '') AS whatsapp_number,
    COALESCE(p.instagram_link, '') AS instagram_link,
    COALESCE(p.facebook_link, '') AS facebook_link,
    COALESCE(p.youtube_link, '') AS youtube_link,
    COALESCE(p.linkedin_link, '') AS linkedin_link,
    COALESCE(p.precise_address, '') AS precise_address,
    COALESCE(p.city, '') AS city,
    COALESCE(p.state, '') AS state,
    COALESCE(p.country, '') AS country,
    COALESCE(p.postal_code, '') AS postal_code,
    COALESCE(p.languages, ARRAY[]::text[]) AS languages,
    COALESCE(p.is_profile_complete, false) AS is_profile_complete,
    p.created_at,
    au.last_sign_in_at,
    COALESCE((SELECT COUNT(*)::integer FROM public.job_applications ja WHERE ja.user_id = p.user_id), 0) AS total_applications,
    COALESCE(p.account_status, 'active') AS account_status
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