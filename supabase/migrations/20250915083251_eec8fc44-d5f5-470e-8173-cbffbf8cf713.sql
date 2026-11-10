-- Fix missing database functions and RLS policies

-- 1. Create missing get_all_employers_enhanced function
CREATE OR REPLACE FUNCTION public.get_all_employers_enhanced(
  p_search text DEFAULT ''::text,
  p_location text DEFAULT ''::text, 
  p_industry text DEFAULT ''::text,
  p_status text DEFAULT 'all'::text,
  p_show_deleted boolean DEFAULT false,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  company_name text,
  email text,
  phone text,
  location text,
  industry text,
  company_size text,
  website text,
  description text,
  logo_url text,
  is_verified boolean,
  is_profile_complete boolean,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  total_jobs integer,
  active_jobs integer,
  badge_color text,
  account_status text,
  account_status_reason text
)
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

  RETURN QUERY
  SELECT 
    c.user_id,
    COALESCE(c.company_name, '') as company_name,
    COALESCE(c.email, '') as email,
    COALESCE(c.phone, '') as phone,
    COALESCE(c.location, '') as location,
    COALESCE(c.industry, '') as industry,
    COALESCE(c.company_size, '') as company_size,
    COALESCE(c.website, '') as website,
    COALESCE(c.description, '') as description,
    COALESCE(c.logo_url, '') as logo_url,
    COALESCE(c.is_verified, false) as is_verified,
    COALESCE(c.is_profile_complete, false) as is_profile_complete,
    c.created_at,
    au.last_sign_in_at,
    COALESCE(
      (SELECT COUNT(*)::integer FROM jobs j WHERE j.company_id = c.id), 
      0
    ) as total_jobs,
    COALESCE(
      (SELECT COUNT(*)::integer FROM jobs j WHERE j.company_id = c.id AND j.status = 'active'), 
      0
    ) as active_jobs,
    c.badge_color,
    COALESCE(c.account_status, 'active'::text) as account_status,
    c.account_status_reason
  FROM public.companies c
  LEFT JOIN auth.users au ON au.id = c.user_id
  WHERE 
    (NOT p_show_deleted AND c.account_status != 'deleted') OR
    (p_show_deleted AND c.account_status = 'deleted') AND
    (p_search = '' OR (
      c.company_name ILIKE '%' || p_search || '%' OR
      c.email ILIKE '%' || p_search || '%' OR
      c.description ILIKE '%' || p_search || '%'
    )) AND
    (p_location = '' OR c.location ILIKE '%' || p_location || '%') AND
    (p_industry = '' OR c.industry ILIKE '%' || p_industry || '%') AND
    (p_status = 'all' OR 
     (p_status = 'active' AND au.last_sign_in_at > NOW() - INTERVAL '30 days') OR
     (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days')))
  ORDER BY c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 2. Fix admin_update_company_verification function
CREATE OR REPLACE FUNCTION public.admin_update_company_verification(
  p_company_id uuid,
  p_is_verified boolean,
  p_badge_color text DEFAULT NULL
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
    badge_color = CASE 
      WHEN p_badge_color IS NOT NULL THEN p_badge_color
      WHEN p_is_verified THEN COALESCE(badge_color, 'gold')
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;
END;
$$;

-- 3. Create admin_update_company_verification_details function
CREATE OR REPLACE FUNCTION public.admin_update_company_verification_details(
  p_company_id uuid,
  p_is_verified boolean,
  p_badge_color text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL
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

  -- Update company verification with details
  UPDATE public.companies 
  SET 
    is_verified = p_is_verified,
    badge_color = CASE 
      WHEN p_badge_color IS NOT NULL THEN p_badge_color
      WHEN p_is_verified THEN COALESCE(badge_color, 'gold')
      ELSE NULL
    END,
    verified_plan_start = CASE 
      WHEN p_is_verified AND p_start_date IS NOT NULL THEN p_start_date
      WHEN p_is_verified AND p_start_date IS NULL THEN NOW()
      ELSE NULL
    END,
    verified_plan_end = CASE
      WHEN p_is_verified AND p_end_date IS NOT NULL THEN p_end_date
      ELSE NULL  
    END,
    updated_at = now()
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;
END;
$$;

-- 4. Fix jobs table RLS policy for INSERT
DROP POLICY IF EXISTS "Users can create jobs for their own company" ON public.jobs;

CREATE POLICY "Users can create jobs for their own company" 
ON public.jobs 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c 
    WHERE c.id = jobs.company_id 
    AND c.user_id = auth.uid()
    AND c.account_status = 'active'
  )
);

-- 5. Create security definer function for admin role checking
CREATE OR REPLACE FUNCTION public.is_admin_user(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = check_user_id 
    AND role IN ('admin', 'owner')
  );
END;
$$;

-- 6. Create function to get company by user
CREATE OR REPLACE FUNCTION public.get_user_company(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  id uuid,
  company_name text,
  is_profile_complete boolean,
  account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.company_name,
    c.is_profile_complete,
    c.account_status
  FROM public.companies c
  WHERE c.user_id = p_user_id;
END;
$$;