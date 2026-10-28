-- Add remaining admin functions
CREATE OR REPLACE FUNCTION admin_update_company_verification_details(
  p_company_id UUID,
  p_is_verified BOOLEAN,
  p_badge_color TEXT DEFAULT NULL,
  p_start TIMESTAMPTZ DEFAULT NULL,
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
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';  
  END IF;

  -- Update company verification
  UPDATE public.companies 
  SET 
    is_verified = p_is_verified,
    badge_color = CASE WHEN p_is_verified THEN p_badge_color ELSE NULL END,
    verified_plan_start = CASE WHEN p_is_verified THEN p_start ELSE NULL END,
    verified_plan_end = CASE WHEN p_is_verified THEN p_end ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found with ID: %', p_company_id;
  END IF;
END;
$$;

-- Function to set job posting visibility
CREATE OR REPLACE FUNCTION admin_set_job_posting_visibility(
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
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update or insert employer settings
  INSERT INTO public.employer_settings (user_id, job_posting_visibility)
  VALUES (p_user_id, p_visible)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    job_posting_visibility = p_visible,
    updated_at = NOW();
END;
$$;

-- Function to set account status
CREATE OR REPLACE FUNCTION admin_set_account_status(
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
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Validate status
  IF p_status NOT IN ('active', 'banned', 'deleted') THEN
    RAISE EXCEPTION 'Invalid status. Must be active, banned, or deleted.';
  END IF;

  -- Update company status
  UPDATE public.companies 
  SET 
    account_status = p_status,
    account_status_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found with ID: %', p_company_id;
  END IF;
END;
$$;

-- Function to get available employer filter options
CREATE OR REPLACE FUNCTION get_available_employer_locations()
RETURNS TABLE(location TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.location,
    COUNT(*) as count
  FROM public.companies c
  WHERE c.location IS NOT NULL 
    AND c.location != ''
    AND c.account_status != 'deleted'
  GROUP BY c.location
  ORDER BY count DESC, c.location;
END;
$$;

CREATE OR REPLACE FUNCTION get_available_employer_industries()
RETURNS TABLE(industry TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.industry,  
    COUNT(*) as count
  FROM public.companies c
  WHERE c.industry IS NOT NULL 
    AND c.industry != ''
    AND c.account_status != 'deleted'
  GROUP BY c.industry
  ORDER BY count DESC, c.industry;
END;
$$;