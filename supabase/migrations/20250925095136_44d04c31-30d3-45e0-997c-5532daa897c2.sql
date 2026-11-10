-- Add RLS policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Create a secure function to get all website users for admins (fallback option)
CREATE OR REPLACE FUNCTION public.get_all_website_users()
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
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = auth.uid() 
    AND admin_users.role IN ('admin', 'owner')
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
    'active'::text as account_status
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  ORDER BY p.created_at DESC;
END;
$$;