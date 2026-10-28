-- Fix all database functions that reference ja.user_id instead of ja.applicant_id
-- This migration updates 7 functions to use the correct column name

-- 1. Fix get_job_applicants_with_emails (CRITICAL - causing current error)
DROP FUNCTION IF EXISTS get_job_applicants_with_emails(uuid);

CREATE OR REPLACE FUNCTION get_job_applicants_with_emails(p_job_id uuid)
RETURNS TABLE (
  application_id uuid,
  job_id uuid,
  user_id uuid,
  applied_at timestamp with time zone,
  status text,
  cover_letter text,
  resume_url text,
  reviewed_at timestamp with time zone,
  full_name text,
  phone text,
  email text,
  location text,
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
  industry text,
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
  languages text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ja.id as application_id,
    ja.job_id,
    ja.applicant_id::uuid as user_id,
    ja.applied_at,
    ja.status,
    ja.cover_letter,
    ja.resume_url,
    ja.reviewed_at,
    p.full_name,
    p.phone,
    au.email,
    p.location,
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
    p.industry,
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
    p.languages
  FROM job_applications ja
  LEFT JOIN profiles p ON ja.applicant_id = p.user_id
  LEFT JOIN auth.users au ON ja.applicant_id = au.id
  WHERE ja.job_id = p_job_id
  ORDER BY ja.applied_at DESC;
END;
$$;

-- 2. Fix get_company_applicants_with_emails
DROP FUNCTION IF EXISTS get_company_applicants_with_emails(uuid);

CREATE OR REPLACE FUNCTION get_company_applicants_with_emails(p_company_id uuid)
RETURNS TABLE (
  application_id uuid,
  job_id uuid,
  user_id uuid,
  applied_at timestamp with time zone,
  status text,
  cover_letter text,
  resume_url text,
  reviewed_at timestamp with time zone,
  full_name text,
  phone text,
  email text,
  location text,
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
  industry text,
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
  job_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ja.id as application_id,
    ja.job_id,
    ja.applicant_id::uuid as user_id,
    ja.applied_at,
    ja.status,
    ja.cover_letter,
    ja.resume_url,
    ja.reviewed_at,
    p.full_name,
    p.phone,
    au.email,
    p.location,
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
    p.industry,
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
    j.title as job_title
  FROM job_applications ja
  LEFT JOIN profiles p ON ja.applicant_id = p.user_id
  LEFT JOIN auth.users au ON ja.applicant_id = au.id
  LEFT JOIN jobs j ON ja.job_id = j.id
  WHERE j.company_id = p_company_id
  ORDER BY ja.applied_at DESC;
END;
$$;

-- 3. Fix get_all_website_users
DROP FUNCTION IF EXISTS get_all_website_users();

CREATE OR REPLACE FUNCTION get_all_website_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamp with time zone,
  full_name text,
  phone text,
  location text,
  user_type text,
  is_banned boolean,
  has_applied boolean,
  application_count bigint,
  company_name text,
  company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email,
    au.created_at,
    p.full_name,
    p.phone,
    p.location,
    p.user_type,
    COALESCE(p.is_banned, false) as is_banned,
    CASE WHEN COUNT(ja.id) > 0 THEN true ELSE false END as has_applied,
    COUNT(ja.id) as application_count,
    c.company_name,
    c.id as company_id
  FROM auth.users au
  LEFT JOIN profiles p ON au.id = p.user_id
  LEFT JOIN job_applications ja ON au.id = ja.applicant_id
  LEFT JOIN companies c ON au.id = c.user_id
  GROUP BY au.id, au.email, au.created_at, p.full_name, p.phone, p.location, p.user_type, p.is_banned, c.company_name, c.id
  ORDER BY au.created_at DESC;
END;
$$;

-- 4. Fix get_personalized_jobs_by_location (4 overloaded versions)
-- Version 1: (user_id, limit)
DROP FUNCTION IF EXISTS get_personalized_jobs_by_location(uuid, integer);

CREATE OR REPLACE FUNCTION get_personalized_jobs_by_location(p_user_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  title text,
  company_id uuid,
  company_name text,
  company_logo_url text,
  location text,
  job_type text,
  experience_level text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  description text,
  requirements text,
  posted_at timestamp with time zone,
  expires_at timestamp with time zone,
  skills text[],
  benefits text[],
  match_score numeric,
  application_count bigint,
  has_applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_location text;
  user_city text;
  user_state text;
BEGIN
  SELECT p.location, p.city, p.state INTO user_location, user_city, user_state
  FROM profiles p
  WHERE p.user_id = p_user_id;

  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
    c.company_name,
    c.logo_url as company_logo_url,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.description,
    j.requirements,
    j.posted_at,
    j.expires_at,
    j.skills,
    j.benefits,
    CASE 
      WHEN j.location = user_location THEN 100
      WHEN j.city = user_city THEN 80
      WHEN j.state = user_state THEN 60
      ELSE 0
    END::numeric as match_score,
    COUNT(ja.id) as application_count,
    EXISTS(SELECT 1 FROM job_applications ja2 WHERE ja2.job_id = j.id AND ja2.applicant_id = p_user_id) as has_applied
  FROM jobs j
  INNER JOIN companies c ON j.company_id = c.id
  LEFT JOIN job_applications ja ON j.id = ja.job_id
  WHERE j.status = 'active' AND (j.expires_at IS NULL OR j.expires_at > NOW())
  GROUP BY j.id, c.id, c.company_name, c.logo_url, user_location, user_city, user_state
  ORDER BY match_score DESC, j.posted_at DESC
  LIMIT p_limit;
END;
$$;

-- Version 2: (user_id, limit, offset)
DROP FUNCTION IF EXISTS get_personalized_jobs_by_location(uuid, integer, integer);

CREATE OR REPLACE FUNCTION get_personalized_jobs_by_location(p_user_id uuid, p_limit integer, p_offset integer)
RETURNS TABLE (
  id uuid,
  title text,
  company_id uuid,
  company_name text,
  company_logo_url text,
  location text,
  job_type text,
  experience_level text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  description text,
  requirements text,
  posted_at timestamp with time zone,
  expires_at timestamp with time zone,
  skills text[],
  benefits text[],
  match_score numeric,
  application_count bigint,
  has_applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_location text;
  user_city text;
  user_state text;
BEGIN
  SELECT p.location, p.city, p.state INTO user_location, user_city, user_state
  FROM profiles p
  WHERE p.user_id = p_user_id;

  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
    c.company_name,
    c.logo_url as company_logo_url,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.description,
    j.requirements,
    j.posted_at,
    j.expires_at,
    j.skills,
    j.benefits,
    CASE 
      WHEN j.location = user_location THEN 100
      WHEN j.city = user_city THEN 80
      WHEN j.state = user_state THEN 60
      ELSE 0
    END::numeric as match_score,
    COUNT(ja.id) as application_count,
    EXISTS(SELECT 1 FROM job_applications ja2 WHERE ja2.job_id = j.id AND ja2.applicant_id = p_user_id) as has_applied
  FROM jobs j
  INNER JOIN companies c ON j.company_id = c.id
  LEFT JOIN job_applications ja ON j.id = ja.job_id
  WHERE j.status = 'active' AND (j.expires_at IS NULL OR j.expires_at > NOW())
  GROUP BY j.id, c.id, c.company_name, c.logo_url, user_location, user_city, user_state
  ORDER BY match_score DESC, j.posted_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Version 3: No parameters
DROP FUNCTION IF EXISTS get_personalized_jobs_by_location();

CREATE OR REPLACE FUNCTION get_personalized_jobs_by_location()
RETURNS TABLE (
  id uuid,
  title text,
  company_id uuid,
  company_name text,
  company_logo_url text,
  location text,
  job_type text,
  experience_level text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  description text,
  requirements text,
  posted_at timestamp with time zone,
  expires_at timestamp with time zone,
  skills text[],
  benefits text[],
  application_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
    c.company_name,
    c.logo_url as company_logo_url,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.description,
    j.requirements,
    j.posted_at,
    j.expires_at,
    j.skills,
    j.benefits,
    COUNT(ja.id) as application_count
  FROM jobs j
  INNER JOIN companies c ON j.company_id = c.id
  LEFT JOIN job_applications ja ON j.id = ja.job_id
  WHERE j.status = 'active' AND (j.expires_at IS NULL OR j.expires_at > NOW())
  GROUP BY j.id, c.id, c.company_name, c.logo_url
  ORDER BY j.posted_at DESC
  LIMIT 10;
END;
$$;

-- Version 4: (location_filter, limit)
DROP FUNCTION IF EXISTS get_personalized_jobs_by_location(text, integer);

CREATE OR REPLACE FUNCTION get_personalized_jobs_by_location(p_location_filter text, p_limit integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  title text,
  company_id uuid,
  company_name text,
  company_logo_url text,
  location text,
  job_type text,
  experience_level text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  description text,
  requirements text,
  posted_at timestamp with time zone,
  expires_at timestamp with time zone,
  skills text[],
  benefits text[],
  match_score numeric,
  application_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
    c.company_name,
    c.logo_url as company_logo_url,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.description,
    j.requirements,
    j.posted_at,
    j.expires_at,
    j.skills,
    j.benefits,
    CASE 
      WHEN j.location ILIKE '%' || p_location_filter || '%' THEN 100
      WHEN j.city ILIKE '%' || p_location_filter || '%' THEN 80
      WHEN j.state ILIKE '%' || p_location_filter || '%' THEN 60
      ELSE 0
    END::numeric as match_score,
    COUNT(ja.id) as application_count
  FROM jobs j
  INNER JOIN companies c ON j.company_id = c.id
  LEFT JOIN job_applications ja ON j.id = ja.job_id
  WHERE j.status = 'active' AND (j.expires_at IS NULL OR j.expires_at > NOW())
  GROUP BY j.id, c.id, c.company_name, c.logo_url, p_location_filter
  ORDER BY match_score DESC, j.posted_at DESC
  LIMIT p_limit;
END;
$$;

-- 5. Fix get_recommended_jobs
DROP FUNCTION IF EXISTS get_recommended_jobs(uuid, integer);

CREATE OR REPLACE FUNCTION get_recommended_jobs(p_user_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  title text,
  company_id uuid,
  company_name text,
  company_logo_url text,
  location text,
  job_type text,
  experience_level text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  description text,
  requirements text,
  posted_at timestamp with time zone,
  expires_at timestamp with time zone,
  skills text[],
  benefits text[],
  match_score numeric,
  application_count bigint,
  has_applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_skills text[];
  user_industry text;
  user_job_type text;
BEGIN
  SELECT p.skills, p.industry, p.job_type INTO user_skills, user_industry, user_job_type
  FROM profiles p
  WHERE p.user_id = p_user_id;

  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
    c.company_name,
    c.logo_url as company_logo_url,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.description,
    j.requirements,
    j.posted_at,
    j.expires_at,
    j.skills,
    j.benefits,
    (
      CASE WHEN j.skills && user_skills THEN 50 ELSE 0 END +
      CASE WHEN j.industry = user_industry THEN 30 ELSE 0 END +
      CASE WHEN j.job_type = user_job_type THEN 20 ELSE 0 END
    )::numeric as match_score,
    COUNT(ja.id) as application_count,
    EXISTS(SELECT 1 FROM job_applications ja2 WHERE ja2.job_id = j.id AND ja2.applicant_id = p_user_id) as has_applied
  FROM jobs j
  INNER JOIN companies c ON j.company_id = c.id
  LEFT JOIN job_applications ja ON j.id = ja.job_id
  WHERE j.status = 'active' AND (j.expires_at IS NULL OR j.expires_at > NOW())
  GROUP BY j.id, c.id, c.company_name, c.logo_url, user_skills, user_industry, user_job_type
  ORDER BY match_score DESC, j.posted_at DESC
  LIMIT p_limit;
END;
$$;

-- 6. Fix get_trending_jobs_optimized_v2
DROP FUNCTION IF EXISTS get_trending_jobs_optimized_v2(integer);

CREATE OR REPLACE FUNCTION get_trending_jobs_optimized_v2(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  title text,
  company_id uuid,
  company_name text,
  company_logo_url text,
  location text,
  job_type text,
  experience_level text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  description text,
  requirements text,
  posted_at timestamp with time zone,
  expires_at timestamp with time zone,
  skills text[],
  benefits text[],
  application_count bigint,
  trending_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
    c.company_name,
    c.logo_url as company_logo_url,
    j.location,
    j.job_type,
    j.experience_level,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.description,
    j.requirements,
    j.posted_at,
    j.expires_at,
    j.skills,
    j.benefits,
    COUNT(ja.id) as application_count,
    (
      COUNT(ja.id)::numeric * 10 +
      EXTRACT(EPOCH FROM (NOW() - j.posted_at))::numeric / 86400 * -1
    ) as trending_score
  FROM jobs j
  INNER JOIN companies c ON j.company_id = c.id
  LEFT JOIN job_applications ja ON j.id = ja.job_id
  WHERE j.status = 'active' 
    AND (j.expires_at IS NULL OR j.expires_at > NOW())
    AND j.posted_at > NOW() - INTERVAL '30 days'
  GROUP BY j.id, c.id, c.company_name, c.logo_url
  ORDER BY trending_score DESC
  LIMIT p_limit;
END;
$$;