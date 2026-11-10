-- Fix existing functions by dropping and recreating them

-- Drop existing functions that might have conflicts
DROP FUNCTION IF EXISTS public.admin_update_company_verification_details(uuid,boolean,text,timestamp with time zone,timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_all_employers_enhanced(text,text,text,text,boolean,integer,integer);

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

-- 2. Create admin_update_company_verification_details function
CREATE OR REPLACE FUNCTION public.admin_update_company_verification_details(
  company_id uuid,
  is_verified boolean,
  badge_color text DEFAULT NULL,
  start_date timestamp with time zone DEFAULT NULL,
  end_date timestamp with time zone DEFAULT NULL
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
    is_verified = admin_update_company_verification_details.is_verified,
    badge_color = CASE 
      WHEN admin_update_company_verification_details.badge_color IS NOT NULL THEN admin_update_company_verification_details.badge_color
      WHEN admin_update_company_verification_details.is_verified THEN COALESCE(companies.badge_color, 'gold')
      ELSE NULL
    END,
    verified_plan_start = CASE 
      WHEN admin_update_company_verification_details.is_verified AND start_date IS NOT NULL THEN start_date
      WHEN admin_update_company_verification_details.is_verified AND start_date IS NULL THEN NOW()
      ELSE NULL
    END,
    verified_plan_end = CASE
      WHEN admin_update_company_verification_details.is_verified AND end_date IS NOT NULL THEN end_date
      ELSE NULL  
    END,
    updated_at = now()
  WHERE id = company_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found with id: %', company_id;
  END IF;
END;
$$;