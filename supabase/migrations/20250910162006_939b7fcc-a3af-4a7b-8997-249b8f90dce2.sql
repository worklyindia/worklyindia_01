-- Create missing RPC functions for employer management

-- Function to get available employer locations
CREATE OR REPLACE FUNCTION public.get_available_employer_locations()
RETURNS TABLE(location text, count bigint)
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

-- Function to get available employer industries
CREATE OR REPLACE FUNCTION public.get_available_employer_industries()
RETURNS TABLE(industry text, count bigint)
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

-- Function to set job posting visibility
CREATE OR REPLACE FUNCTION public.admin_set_job_posting_visibility(
  p_user_id uuid,
  p_visible boolean
)
RETURNS void
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

  -- Update or insert employer settings
  INSERT INTO public.employer_settings (user_id, job_posting_visibility)
  VALUES (p_user_id, p_visible)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    job_posting_visibility = p_visible,
    updated_at = now();
END;
$$;

-- Function to set account status
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  p_company_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
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

  -- Update company account status
  UPDATE public.companies 
  SET 
    account_status = p_status,
    account_status_reason = p_reason,
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;

-- Function to soft delete company
CREATE OR REPLACE FUNCTION public.admin_soft_delete_company(
  p_company_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
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

  -- Soft delete company
  UPDATE public.companies 
  SET 
    account_status = 'deleted',
    account_status_reason = p_reason,
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;

-- Function to update company verification with details
CREATE OR REPLACE FUNCTION public.admin_update_company_verification_details(
  p_company_id uuid,
  p_is_verified boolean,
  p_badge_color text DEFAULT 'gold',
  p_start text DEFAULT NULL,
  p_end text DEFAULT NULL
)
RETURNS void
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
  UPDATE public.companies 
  SET 
    is_verified = p_is_verified,
    badge_color = CASE WHEN p_is_verified THEN p_badge_color ELSE NULL END,
    verified_plan_start = CASE 
      WHEN p_is_verified AND p_start IS NOT NULL THEN p_start::timestamp with time zone 
      WHEN p_is_verified THEN now()
      ELSE NULL 
    END,
    verified_plan_end = CASE 
      WHEN p_is_verified AND p_end IS NOT NULL THEN p_end::timestamp with time zone 
      WHEN p_is_verified THEN '2099-12-31 23:59:59+00'::timestamp with time zone
      ELSE NULL 
    END,
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;

-- Function to update company verification (existing one)
CREATE OR REPLACE FUNCTION public.admin_update_company_verification(
  p_company_id uuid,
  p_is_verified boolean,
  p_badge_color text DEFAULT 'gold'
)
RETURNS void
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
  UPDATE public.companies 
  SET 
    is_verified = p_is_verified,
    badge_color = CASE WHEN p_is_verified THEN p_badge_color ELSE NULL END,
    verified_plan_start = CASE WHEN p_is_verified THEN now() ELSE NULL END,
    verified_plan_end = CASE 
      WHEN p_is_verified THEN '2099-12-31 23:59:59+00'::timestamp with time zone 
      ELSE NULL 
    END,
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;