-- Create or replace the admin_update_company_verification_details function with correct parameters
CREATE OR REPLACE FUNCTION public.admin_update_company_verification_details(
  target_user_id uuid,
  is_verified boolean,
  badge_color text DEFAULT NULL,
  verified_plan_start timestamp with time zone DEFAULT NULL,
  verified_plan_end timestamp with time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  -- Update company verification details
  UPDATE public.companies
  SET 
    is_verified = admin_update_company_verification_details.is_verified,
    badge_color = admin_update_company_verification_details.badge_color,
    verified_plan_start = admin_update_company_verification_details.verified_plan_start,
    verified_plan_end = admin_update_company_verification_details.verified_plan_end,
    updated_at = now()
  WHERE user_id = target_user_id;

  -- Check if company was found and updated
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user ID: %', target_user_id;
  END IF;
END;
$function$;