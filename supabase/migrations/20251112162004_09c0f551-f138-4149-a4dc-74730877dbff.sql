-- Fix type mismatch in get_latest_jobs_with_priority_v2
DROP FUNCTION IF EXISTS get_latest_jobs_with_priority_v2(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_latest_jobs_with_priority_v2(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  company_id UUID,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT,
  salary_period TEXT,
  salary_range TEXT,
  job_type TEXT,
  experience_level TEXT,
  description TEXT,
  requirements TEXT,
  responsibilities TEXT,
  skills TEXT[],
  benefits TEXT[],
  application_deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  visibility TEXT,
  trending_score INTEGER,
  views_count BIGINT,
  applications_count BIGINT,
  calls_count INTEGER,
  shares_count INTEGER,
  is_featured BOOLEAN,
  featured_until TIMESTAMP WITH TIME ZONE,
  is_boosted BOOLEAN,
  boost_level INTEGER,
  boost_end_date TIMESTAMP WITH TIME ZONE,
  boost_bonus_applied INTEGER,
  work_mode TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  api_source TEXT,
  api_job_id TEXT,
  api_company_name TEXT,
  priority_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
    j.location,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.salary_period,
    j.salary_range,
    j.job_type,
    j.experience_level,
    j.description,
    j.requirements,
    j.responsibilities,
    j.skills,
    j.benefits,
    j.application_deadline,
    j.created_at,
    j.updated_at,
    j.status,
    j.visibility,
    j.trending_score,
    j.views_count::bigint,
    j.applications_count::bigint,
    j.calls_count,
    j.shares_count,
    j.is_featured,
    j.featured_until,
    j.is_boosted,
    j.boost_level,
    j.boost_end_date,
    j.boost_bonus_applied,
    j.work_mode,
    j.contact_email,
    j.contact_phone,
    j.api_source,
    j.api_job_id,
    j.api_company_name,
    (
      COALESCE(j.trending_score, 0) * 2 +
      (CASE WHEN j.is_featured AND j.featured_until > NOW() THEN 1000 ELSE 0 END) +
      (CASE WHEN j.is_boosted AND j.boost_end_date > NOW() THEN j.boost_level * 500 ELSE 0 END) +
      (EXTRACT(EPOCH FROM (NOW() - j.created_at)) / -3600)::INTEGER
    )::NUMERIC as priority_score
  FROM jobs j
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY priority_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Fix type mismatch in get_personalized_jobs_v3
DROP FUNCTION IF EXISTS get_personalized_jobs_v3(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_personalized_jobs_v3(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  company_id UUID,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT,
  salary_period TEXT,
  salary_range TEXT,
  job_type TEXT,
  experience_level TEXT,
  description TEXT,
  requirements TEXT,
  responsibilities TEXT,
  skills TEXT[],
  benefits TEXT[],
  application_deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  visibility TEXT,
  trending_score INTEGER,
  views_count BIGINT,
  applications_count BIGINT,
  calls_count INTEGER,
  shares_count INTEGER,
  is_featured BOOLEAN,
  featured_until TIMESTAMP WITH TIME ZONE,
  is_boosted BOOLEAN,
  boost_level INTEGER,
  boost_end_date TIMESTAMP WITH TIME ZONE,
  boost_bonus_applied INTEGER,
  work_mode TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  api_source TEXT,
  api_job_id TEXT,
  api_company_name TEXT,
  relevance_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
    j.location,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.salary_period,
    j.salary_range,
    j.job_type,
    j.experience_level,
    j.description,
    j.requirements,
    j.responsibilities,
    j.skills,
    j.benefits,
    j.application_deadline,
    j.created_at,
    j.updated_at,
    j.status,
    j.visibility,
    j.trending_score,
    j.views_count::bigint,
    j.applications_count::bigint,
    j.calls_count,
    j.shares_count,
    j.is_featured,
    j.featured_until,
    j.is_boosted,
    j.boost_level,
    j.boost_end_date,
    j.boost_bonus_applied,
    j.work_mode,
    j.contact_email,
    j.contact_phone,
    j.api_source,
    j.api_job_id,
    j.api_company_name,
    (
      COALESCE(j.trending_score, 0) +
      (CASE WHEN j.is_featured AND j.featured_until > NOW() THEN 500 ELSE 0 END) +
      (CASE WHEN j.is_boosted AND j.boost_end_date > NOW() THEN j.boost_level * 200 ELSE 0 END)
    )::NUMERIC as relevance_score
  FROM jobs j
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY relevance_score DESC, j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Fix type mismatch in get_trending_jobs_optimized_v2
DROP FUNCTION IF EXISTS get_trending_jobs_optimized_v2(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_trending_jobs_optimized_v2(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  company_id UUID,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT,
  salary_period TEXT,
  salary_range TEXT,
  job_type TEXT,
  experience_level TEXT,
  description TEXT,
  requirements TEXT,
  responsibilities TEXT,
  skills TEXT[],
  benefits TEXT[],
  application_deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  visibility TEXT,
  trending_score INTEGER,
  views_count BIGINT,
  applications_count BIGINT,
  calls_count INTEGER,
  shares_count INTEGER,
  is_featured BOOLEAN,
  featured_until TIMESTAMP WITH TIME ZONE,
  is_boosted BOOLEAN,
  boost_level INTEGER,
  boost_end_date TIMESTAMP WITH TIME ZONE,
  boost_bonus_applied INTEGER,
  work_mode TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  api_source TEXT,
  api_job_id TEXT,
  api_company_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.title,
    j.company_id,
    j.location,
    j.salary_min,
    j.salary_max,
    j.salary_currency,
    j.salary_period,
    j.salary_range,
    j.job_type,
    j.experience_level,
    j.description,
    j.requirements,
    j.responsibilities,
    j.skills,
    j.benefits,
    j.application_deadline,
    j.created_at,
    j.updated_at,
    j.status,
    j.visibility,
    j.trending_score,
    j.views_count::bigint,
    j.applications_count::bigint,
    j.calls_count,
    j.shares_count,
    j.is_featured,
    j.featured_until,
    j.is_boosted,
    j.boost_level,
    j.boost_end_date,
    j.boost_bonus_applied,
    j.work_mode,
    j.contact_email,
    j.contact_phone,
    j.api_source,
    j.api_job_id,
    j.api_company_name
  FROM jobs j
  WHERE j.status = 'active'
    AND j.visibility = 'public'
  ORDER BY j.trending_score DESC NULLS LAST, j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;