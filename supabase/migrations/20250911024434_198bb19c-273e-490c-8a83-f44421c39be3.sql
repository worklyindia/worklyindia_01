-- Fix the admin verification function to use the correct parameter
CREATE OR REPLACE FUNCTION public.admin_update_company_verification_details(
  p_company_id uuid,
  p_is_verified boolean,
  p_badge_color text DEFAULT NULL,
  p_start timestamp with time zone DEFAULT NULL,
  p_end timestamp with time zone DEFAULT NULL
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
    RAISE EXCEPTION 'Admin role required to update verification details';
  END IF;

  -- Update company verification using user_id since that's what we have in the UI
  UPDATE public.companies 
  SET 
    is_verified = p_is_verified,
    badge_color = CASE WHEN p_is_verified THEN p_badge_color ELSE NULL END,
    verified_plan_start = CASE WHEN p_is_verified THEN p_start ELSE NULL END,
    verified_plan_end = CASE WHEN p_is_verified THEN p_end ELSE NULL END,
    updated_at = NOW()
  WHERE user_id = p_company_id; -- Use user_id since p_company_id is actually user_id from UI

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user';
  END IF;
END;
$$;