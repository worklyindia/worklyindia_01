-- Create function to get website users with real emails (admin only)
CREATE OR REPLACE FUNCTION public.get_all_website_users(
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
SET search_path = public
AS $$
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
    'active' as account_status
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
$$;