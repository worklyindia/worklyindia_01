-- Fix is_admin() function calls - remove auth.uid() parameter
-- This migration updates 8 functions that incorrectly call is_admin(auth.uid())
-- The is_admin() function doesn't take parameters, it uses auth.uid() internally

-- 1. Fix get_all_website_users
DROP FUNCTION IF EXISTS public.get_all_website_users(text, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_all_website_users(
  p_search text DEFAULT '',
  p_location text DEFAULT '',
  p_industry text DEFAULT '',
  p_status text DEFAULT '',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
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
  total_applications bigint,
  account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    p.email,
    p.phone,
    p.location,
    p.industry,
    p.current_position,
    p.company,
    p.skills,
    p.profile_image_url,
    p.bio,
    p.education,
    p.experience_years,
    p.experience_level,
    p.preferred_location,
    p.job_type,
    p.whatsapp_number,
    p.instagram_link,
    p.facebook_link,
    p.youtube_link,
    p.linkedin_link,
    p.precise_address,
    p.city,
    p.state,
    p.country,
    p.postal_code,
    p.languages,
    p.is_profile_complete,
    p.created_at,
    p.last_sign_in_at,
    COALESCE(app_count.total, 0) as total_applications,
    COALESCE(p.account_status, 'active') as account_status
  FROM profiles p
  LEFT JOIN (
    SELECT user_id, COUNT(*) as total
    FROM job_applications
    GROUP BY user_id
  ) app_count ON app_count.user_id = p.user_id
  WHERE 
    (p_search = '' OR 
     p.full_name ILIKE '%' || p_search || '%' OR 
     p.email ILIKE '%' || p_search || '%' OR
     p.phone ILIKE '%' || p_search || '%')
    AND (p_location = '' OR p.location = p_location)
    AND (p_industry = '' OR p.industry = p_industry)
    AND (p_status = '' OR COALESCE(p.account_status, 'active') = p_status)
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_website_users(text, text, text, text, integer, integer) TO authenticated;

-- 2. Fix get_owner_overview_statistics
DROP FUNCTION IF EXISTS public.get_owner_overview_statistics();

CREATE OR REPLACE FUNCTION public.get_owner_overview_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_build_object(
    'totalUsers', (SELECT COUNT(*) FROM profiles),
    'totalJobs', (SELECT COUNT(*) FROM jobs),
    'totalApplications', (SELECT COUNT(*) FROM job_applications),
    'activeJobs', (SELECT COUNT(*) FROM jobs WHERE status = 'active')
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_owner_overview_statistics() TO authenticated;

-- 3. Fix get_financial_statistics
DROP FUNCTION IF EXISTS public.get_financial_statistics();

CREATE OR REPLACE FUNCTION public.get_financial_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_build_object(
    'totalRevenue', COALESCE(SUM(amount), 0),
    'pendingPayments', COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0),
    'completedPayments', COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0)
  ) INTO result
  FROM payments;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_statistics() TO authenticated;

-- 4. Fix get_user_location_statistics
DROP FUNCTION IF EXISTS public.get_user_location_statistics();

CREATE OR REPLACE FUNCTION public.get_user_location_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_agg(
    json_build_object(
      'location', location,
      'count', count
    )
  ) INTO result
  FROM (
    SELECT location, COUNT(*) as count
    FROM profiles
    WHERE location IS NOT NULL AND location != ''
    GROUP BY location
    ORDER BY count DESC
    LIMIT 10
  ) location_stats;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_location_statistics() TO authenticated;

-- 5. Fix get_login_activity_statistics
DROP FUNCTION IF EXISTS public.get_login_activity_statistics();

CREATE OR REPLACE FUNCTION public.get_login_activity_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_agg(
    json_build_object(
      'date', date,
      'count', count
    )
  ) INTO result
  FROM (
    SELECT DATE(last_sign_in_at) as date, COUNT(*) as count
    FROM profiles
    WHERE last_sign_in_at IS NOT NULL
      AND last_sign_in_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(last_sign_in_at)
    ORDER BY date DESC
  ) login_stats;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_activity_statistics() TO authenticated;

-- 6. Fix get_new_accounts_statistics
DROP FUNCTION IF EXISTS public.get_new_accounts_statistics();

CREATE OR REPLACE FUNCTION public.get_new_accounts_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  SELECT json_agg(
    json_build_object(
      'date', date,
      'count', count
    )
  ) INTO result
  FROM (
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM profiles
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  ) account_stats;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_new_accounts_statistics() TO authenticated;

-- 7. Fix get_all_employers_enhanced
DROP FUNCTION IF EXISTS public.get_all_employers_enhanced(text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_all_employers_enhanced(
  p_search text DEFAULT '',
  p_industry text DEFAULT '',
  p_status text DEFAULT '',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  company_name text,
  email text,
  phone text,
  industry text,
  company_size text,
  website text,
  location text,
  description text,
  logo_url text,
  verification_status text,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  total_jobs_posted bigint,
  active_jobs bigint,
  account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    e.user_id,
    e.company_name,
    e.email,
    e.phone,
    e.industry,
    e.company_size,
    e.website,
    e.location,
    e.description,
    e.logo_url,
    e.verification_status,
    e.created_at,
    e.last_sign_in_at,
    COALESCE(job_stats.total_jobs, 0) as total_jobs_posted,
    COALESCE(job_stats.active_jobs, 0) as active_jobs,
    COALESCE(e.account_status, 'active') as account_status
  FROM employers e
  LEFT JOIN (
    SELECT 
      employer_id,
      COUNT(*) as total_jobs,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_jobs
    FROM jobs
    GROUP BY employer_id
  ) job_stats ON job_stats.employer_id = e.user_id
  WHERE 
    (p_search = '' OR 
     e.company_name ILIKE '%' || p_search || '%' OR 
     e.email ILIKE '%' || p_search || '%')
    AND (p_industry = '' OR e.industry = p_industry)
    AND (p_status = '' OR COALESCE(e.account_status, 'active') = p_status)
  ORDER BY e.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_employers_enhanced(text, text, text, integer, integer) TO authenticated;

-- 8. Fix admin_update_jobseeker_profile_full
DROP FUNCTION IF EXISTS public.admin_update_jobseeker_profile_full(uuid, text, text, text, text, text, text, text, text[], text[], integer, text, text, text, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_update_jobseeker_profile_full(
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
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update profile with all provided fields
  UPDATE profiles
  SET
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

  RETURN json_build_object('success', true, 'message', 'Profile updated successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_jobseeker_profile_full(uuid, text, text, text, text, text, text, text, text[], text[], integer, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;