-- Fix verification admin function
DROP FUNCTION IF EXISTS public.admin_update_company_verification_details(uuid,boolean,text,timestamptz,timestamptz);

-- Create clean admin function to update company verification
CREATE OR REPLACE FUNCTION public.admin_update_company_verification_details(
  p_user_id uuid,
  p_is_verified boolean,
  p_badge_color text DEFAULT NULL,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Admin role required to update verification settings';
  END IF;

  -- Update company verification using user_id
  UPDATE public.companies SET
    is_verified = p_is_verified,
    badge_color = CASE WHEN p_is_verified THEN p_badge_color ELSE NULL END,
    verified_plan_start = CASE WHEN p_is_verified THEN p_start ELSE NULL END,
    verified_plan_end = CASE WHEN p_is_verified THEN p_end ELSE NULL END,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user_id: %', p_user_id;
  END IF;
END;
$$;