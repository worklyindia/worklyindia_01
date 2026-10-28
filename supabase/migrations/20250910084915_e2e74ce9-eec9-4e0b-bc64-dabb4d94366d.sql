-- Create setup_initial_admin_user function
CREATE OR REPLACE FUNCTION public.setup_initial_admin_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if there are any admin users
  IF NOT EXISTS (SELECT 1 FROM public.admin_users) THEN
    -- Get the first user from auth.users and make them owner
    INSERT INTO public.admin_users (user_id, role, created_by)
    SELECT id, 'owner', id
    FROM auth.users
    LIMIT 1
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

-- Create admin_update_user_status function
CREATE OR REPLACE FUNCTION public.admin_update_user_status(p_user_id uuid, p_action text)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update user status based on action
  IF p_action = 'activate' THEN
    -- For now, just log the action (could extend to update a status field if needed)
    RAISE NOTICE 'User % activated by admin %', p_user_id, auth.uid();
  ELSIF p_action = 'deactivate' THEN
    -- For now, just log the action (could extend to update a status field if needed)
    RAISE NOTICE 'User % deactivated by admin %', p_user_id, auth.uid();
  ELSE
    RAISE EXCEPTION 'Invalid action. Use activate or deactivate.';
  END IF;
END;
$$;

-- Create admin_update_jobseeker_profile function
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
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update profile with provided values
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

-- Create get_total_jobseekers_count function
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
  -- Check if user has admin role
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

-- Create admin_update_company_profile function  
CREATE OR REPLACE FUNCTION public.admin_update_company_profile(
  company_id text,
  company_name text DEFAULT NULL,
  business_type text DEFAULT NULL,
  email text DEFAULT NULL,
  phone text DEFAULT NULL,
  website text DEFAULT NULL,
  industry text DEFAULT NULL,
  company_details text DEFAULT NULL,
  logo_url text DEFAULT NULL,
  legal_name text DEFAULT NULL,
  cin_number text DEFAULT NULL,
  gst_number text DEFAULT NULL,
  msme_number text DEFAULT NULL,
  pan_number text DEFAULT NULL,
  incorporation_date text DEFAULT NULL,
  country text DEFAULT NULL,
  state text DEFAULT NULL,
  city text DEFAULT NULL,
  postal_code text DEFAULT NULL,
  precise_address text DEFAULT NULL,
  organisation_size text DEFAULT NULL,
  hr_contact_name text DEFAULT NULL,
  whatsapp_number text DEFAULT NULL,
  instagram_link text DEFAULT NULL,
  facebook_link text DEFAULT NULL,
  youtube_link text DEFAULT NULL,
  linkedin_link text DEFAULT NULL,
  services_description text DEFAULT NULL,
  pricing_plans text DEFAULT NULL,
  differentiating_factors text DEFAULT NULL,
  clients_description text DEFAULT NULL,
  testimonials text DEFAULT NULL,
  data_privacy_measures text DEFAULT NULL,
  refund_policy text DEFAULT NULL,
  dispute_resolution text DEFAULT NULL,
  rbi_compliance text DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update company with provided values
  UPDATE public.companies SET
    company_name = COALESCE(admin_update_company_profile.company_name, companies.company_name),
    business_type = COALESCE(admin_update_company_profile.business_type, companies.business_type),
    email = COALESCE(admin_update_company_profile.email, companies.email),
    phone = COALESCE(admin_update_company_profile.phone, companies.phone),
    website = COALESCE(admin_update_company_profile.website, companies.website),
    industry = COALESCE(admin_update_company_profile.industry, companies.industry),
    company_details = COALESCE(admin_update_company_profile.company_details, companies.company_details),
    logo_url = COALESCE(admin_update_company_profile.logo_url, companies.logo_url),
    legal_name = COALESCE(admin_update_company_profile.legal_name, companies.legal_name),
    cin_number = COALESCE(admin_update_company_profile.cin_number, companies.cin_number),
    gst_number = COALESCE(admin_update_company_profile.gst_number, companies.gst_number),
    msme_number = COALESCE(admin_update_company_profile.msme_number, companies.msme_number),
    pan_number = COALESCE(admin_update_company_profile.pan_number, companies.pan_number),
    incorporation_date = CASE 
      WHEN admin_update_company_profile.incorporation_date IS NOT NULL 
      THEN admin_update_company_profile.incorporation_date::date 
      ELSE companies.incorporation_date 
    END,
    country = COALESCE(admin_update_company_profile.country, companies.country),
    state = COALESCE(admin_update_company_profile.state, companies.state),
    city = COALESCE(admin_update_company_profile.city, companies.city),
    postal_code = COALESCE(admin_update_company_profile.postal_code, companies.postal_code),
    precise_address = COALESCE(admin_update_company_profile.precise_address, companies.precise_address),
    organisation_size = COALESCE(admin_update_company_profile.organisation_size, companies.organisation_size),
    hr_contact_name = COALESCE(admin_update_company_profile.hr_contact_name, companies.hr_contact_name),
    whatsapp_number = COALESCE(admin_update_company_profile.whatsapp_number, companies.whatsapp_number),
    instagram_link = COALESCE(admin_update_company_profile.instagram_link, companies.instagram_link),
    facebook_link = COALESCE(admin_update_company_profile.facebook_link, companies.facebook_link),
    youtube_link = COALESCE(admin_update_company_profile.youtube_link, companies.youtube_link),
    linkedin_link = COALESCE(admin_update_company_profile.linkedin_link, companies.linkedin_link),
    services_description = COALESCE(admin_update_company_profile.services_description, companies.services_description),
    pricing_plans = COALESCE(admin_update_company_profile.pricing_plans, companies.pricing_plans),
    differentiating_factors = COALESCE(admin_update_company_profile.differentiating_factors, companies.differentiating_factors),
    clients_description = COALESCE(admin_update_company_profile.clients_description, companies.clients_description),
    testimonials = COALESCE(admin_update_company_profile.testimonials, companies.testimonials),
    data_privacy_measures = COALESCE(admin_update_company_profile.data_privacy_measures, companies.data_privacy_measures),
    refund_policy = COALESCE(admin_update_company_profile.refund_policy, companies.refund_policy),
    dispute_resolution = COALESCE(admin_update_company_profile.dispute_resolution, companies.dispute_resolution),
    rbi_compliance = COALESCE(admin_update_company_profile.rbi_compliance, companies.rbi_compliance),
    updated_at = now()
  WHERE id = company_id::uuid
  RETURNING to_jsonb(companies.*) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Company not found with id %', company_id;
  END IF;

  RETURN result;
END;
$$;

-- Create get_total_employers_count function
CREATE OR REPLACE FUNCTION public.get_total_employers_count(
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
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT COUNT(*)::INTEGER INTO total_count
  FROM public.companies c
  LEFT JOIN auth.users au ON au.id = c.user_id
  WHERE 
    (p_search = '' OR (
      c.company_name ILIKE '%' || p_search || '%' OR
      c.email ILIKE '%' || p_search || '%' OR
      c.description ILIKE '%' || p_search || '%'
    ))
    AND (p_location = '' OR c.location ILIKE '%' || p_location || '%')
    AND (p_industry = '' OR c.industry ILIKE '%' || p_industry || '%')
    AND (p_status = 'all' OR 
         (p_status = 'active' AND au.last_sign_in_at > NOW() - INTERVAL '30 days') OR
         (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days')));

  RETURN total_count;
END;
$$;