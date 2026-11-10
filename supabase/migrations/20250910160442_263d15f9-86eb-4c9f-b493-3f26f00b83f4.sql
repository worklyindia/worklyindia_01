-- Add account status and verification management columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'banned', 'deleted')),
ADD COLUMN IF NOT EXISTS account_status_reason TEXT;

-- Admin function to update company verification details
CREATE OR REPLACE FUNCTION public.admin_update_company_verification_details(
  p_company_id UUID,
  p_is_verified BOOLEAN,
  p_badge_color TEXT DEFAULT NULL,
  p_start TIMESTAMPTZ DEFAULT NOW(),
  p_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Update company verification
  UPDATE public.companies SET
    is_verified = p_is_verified,
    badge_color = p_badge_color,
    verified_plan_start = p_start,
    verified_plan_end = p_end,
    updated_at = NOW()
  WHERE id = p_company_id;
END;
$$;

-- Admin function to set job posting visibility
CREATE OR REPLACE FUNCTION public.admin_set_job_posting_visibility(
  p_user_id UUID,
  p_visible BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Upsert employer settings
  INSERT INTO public.employer_settings (user_id, job_posting_visibility)
  VALUES (p_user_id, p_visible)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    job_posting_visibility = p_visible,
    updated_at = NOW();
END;
$$;

-- Admin function to set account status
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  p_company_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Validate status
  IF p_status NOT IN ('active', 'banned', 'deleted') THEN
    RAISE EXCEPTION 'Invalid status. Must be active, banned, or deleted.';
  END IF;

  -- Update company status
  UPDATE public.companies SET
    account_status = p_status,
    account_status_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_company_id;
END;
$$;

-- Admin function to soft delete company
CREATE OR REPLACE FUNCTION public.admin_soft_delete_company(
  p_company_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  company_user_id UUID;
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get company user_id
  SELECT user_id INTO company_user_id 
  FROM public.companies 
  WHERE id = p_company_id;

  IF company_user_id IS NULL THEN
    RAISE EXCEPTION 'Company not found.';
  END IF;

  -- Set company as deleted
  UPDATE public.companies SET
    account_status = 'deleted',
    account_status_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_company_id;

  -- Disable job posting visibility
  INSERT INTO public.employer_settings (user_id, job_posting_visibility)
  VALUES (company_user_id, false)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    job_posting_visibility = false,
    updated_at = NOW();
END;
$$;

-- Update get_all_employers_enhanced to include new fields and exclude deleted
CREATE OR REPLACE FUNCTION public.get_all_employers_enhanced(
  p_search TEXT DEFAULT '',
  p_location TEXT DEFAULT '',
  p_industry TEXT DEFAULT '',
  p_status TEXT DEFAULT 'all',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  user_id UUID,
  company_id UUID,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  industry TEXT,
  company_size TEXT,
  website TEXT,
  description TEXT,
  logo_url TEXT,
  is_verified BOOLEAN,
  badge_color TEXT,
  is_profile_complete BOOLEAN,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  total_jobs INTEGER,
  active_jobs INTEGER,
  account_status TEXT,
  account_status_reason TEXT,
  job_posting_visibility BOOLEAN,
  verified_plan_start TIMESTAMPTZ,
  verified_plan_end TIMESTAMPTZ,
  precise_address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  RETURN QUERY
  SELECT 
    c.user_id,
    c.id AS company_id,
    COALESCE(c.company_name, '') AS company_name,
    COALESCE(c.email, '') AS email,
    COALESCE(c.phone, '') AS phone,
    COALESCE(c.location, '') AS location,
    COALESCE(c.industry, '') AS industry,
    COALESCE(c.company_size, '') AS company_size,
    COALESCE(c.website, '') AS website,
    COALESCE(c.description, '') AS description,
    COALESCE(c.logo_url, '') AS logo_url,
    COALESCE(c.is_verified, false) AS is_verified,
    c.badge_color,
    COALESCE(c.is_profile_complete, false) AS is_profile_complete,
    c.created_at,
    au.last_sign_in_at,
    COALESCE(
      (SELECT COUNT(*)::integer FROM jobs j WHERE j.company_id = c.id), 
      0
    ) AS total_jobs,
    COALESCE(
      (SELECT COUNT(*)::integer FROM jobs j WHERE j.company_id = c.id AND j.status = 'active'), 
      0
    ) AS active_jobs,
    COALESCE(c.account_status, 'active') AS account_status,
    c.account_status_reason,
    COALESCE(es.job_posting_visibility, true) AS job_posting_visibility,
    c.verified_plan_start,
    c.verified_plan_end,
    COALESCE(c.precise_address, '') AS precise_address,
    COALESCE(c.city, '') AS city,
    COALESCE(c.state, '') AS state,
    COALESCE(c.country, '') AS country,
    COALESCE(c.postal_code, '') AS postal_code
  FROM public.companies c
  LEFT JOIN auth.users au ON au.id = c.user_id
  LEFT JOIN public.employer_settings es ON es.user_id = c.user_id
  WHERE 
    c.account_status != 'deleted'
    AND (p_search = '' OR (
      c.company_name ILIKE '%' || p_search || '%' OR
      c.email ILIKE '%' || p_search || '%' OR
      c.description ILIKE '%' || p_search || '%'
    ))
    AND (p_location = '' OR c.location ILIKE '%' || p_location || '%')
    AND (p_industry = '' OR c.industry ILIKE '%' || p_industry || '%')
    AND (p_status = 'all' OR 
         (p_status = 'active' AND au.last_sign_in_at > NOW() - INTERVAL '30 days') OR
         (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days')))
  ORDER BY c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;