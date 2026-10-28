-- Create get_total_jobseekers_count function (idempotent)
CREATE OR REPLACE FUNCTION public.get_total_jobseekers_count(
  p_search text DEFAULT '',
  p_location text DEFAULT '',
  p_industry text DEFAULT '',
  p_status text DEFAULT 'all'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  total_count INTEGER := 0;
BEGIN
  -- Require admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT COUNT(*)::INTEGER INTO total_count
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

  RETURN total_count;
END;
$$;

-- Create admin_update_jobseeker_profile function (idempotent)
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
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Require admin
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

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
    updated_at = now()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id;
  END IF;
END;
$$;