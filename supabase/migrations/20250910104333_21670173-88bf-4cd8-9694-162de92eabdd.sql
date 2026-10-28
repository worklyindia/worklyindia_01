-- Enhanced search function for employer management with multi-field search
CREATE OR REPLACE FUNCTION public.get_all_employers_enhanced(
  p_search text DEFAULT '',
  p_location text DEFAULT '',
  p_industry text DEFAULT '',
  p_status text DEFAULT 'all',
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
  badge_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    COALESCE(c.badge_color, '') as badge_color
  FROM public.companies c
  LEFT JOIN auth.users au ON au.id = c.user_id
  WHERE 
    (p_search = '' OR (
      c.company_name ILIKE '%' || p_search || '%' OR
      c.email ILIKE '%' || p_search || '%' OR
      c.phone ILIKE '%' || p_search || '%' OR
      c.user_id::text ILIKE '%' || p_search || '%' OR
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
$function$;

-- Function to get available locations for dynamic filtering
CREATE OR REPLACE FUNCTION public.get_available_employer_locations()
RETURNS TABLE(location text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    c.location,
    COUNT(*) as count
  FROM public.companies c
  WHERE c.location IS NOT NULL 
    AND c.location != ''
  GROUP BY c.location
  ORDER BY count DESC, c.location ASC;
END;
$function$;

-- Function to get available industries for dynamic filtering
CREATE OR REPLACE FUNCTION public.get_available_employer_industries()
RETURNS TABLE(industry text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    c.industry,
    COUNT(*) as count
  FROM public.companies c
  WHERE c.industry IS NOT NULL 
    AND c.industry != ''
  GROUP BY c.industry
  ORDER BY count DESC, c.industry ASC;
END;
$function$;

-- Function for admin to update company verification with badge color
CREATE OR REPLACE FUNCTION public.admin_update_company_verification(
  p_company_id uuid,
  p_is_verified boolean,
  p_badge_color text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update company verification status
  UPDATE public.companies 
  SET 
    is_verified = p_is_verified,
    badge_color = p_badge_color,
    updated_at = NOW()
  WHERE user_id = p_company_id;
END;
$function$;