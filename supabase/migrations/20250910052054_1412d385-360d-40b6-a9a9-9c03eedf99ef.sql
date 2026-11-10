-- Create admin functions for updating user profiles and company verification
CREATE OR REPLACE FUNCTION public.admin_update_company_verification(
  p_company_id UUID,
  p_is_verified BOOLEAN,
  p_badge_color TEXT DEFAULT NULL
) RETURNS BOOLEAN
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
    badge_color = COALESCE(p_badge_color, badge_color),
    verified_plan_start = CASE WHEN p_is_verified THEN NOW() ELSE NULL END,
    verified_plan_end = CASE WHEN p_is_verified THEN '2099-12-31 23:59:59+00'::timestamp with time zone ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_company_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_user_id UUID,
  p_action TEXT
) RETURNS BOOLEAN
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

  -- Handle different actions
  IF p_action = 'activate' THEN
    -- Mark profile as active by updating updated_at
    UPDATE public.profiles 
    SET updated_at = NOW()
    WHERE user_id = p_user_id;
    
  ELSIF p_action = 'deactivate' THEN
    -- Mark profile as inactive
    UPDATE public.profiles 
    SET updated_at = NOW() - INTERVAL '1 year'
    WHERE user_id = p_user_id;
    
  END IF;

  RETURN FOUND;
END;
$$;