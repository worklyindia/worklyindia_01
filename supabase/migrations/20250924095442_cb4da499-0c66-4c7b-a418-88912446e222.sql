-- Create or replace the admin function to update company verification details
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
  -- Check admin permissions first
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Check if company exists for this user
  IF NOT EXISTS (
    SELECT 1 FROM companies WHERE user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Company not found for user_id: %', target_user_id;
  END IF;

  -- Update company verification details
  UPDATE companies SET
    is_verified = admin_update_company_verification_details.is_verified,
    badge_color = admin_update_company_verification_details.badge_color,
    verified_plan_start = admin_update_company_verification_details.verified_plan_start,
    verified_plan_end = admin_update_company_verification_details.verified_plan_end,
    updated_at = now()
  WHERE user_id = target_user_id;

  -- Log the verification change for audit trail
  INSERT INTO company_audit_logs (
    company_id, 
    admin_id, 
    action, 
    old_status, 
    new_status, 
    reason
  ) 
  SELECT 
    c.id,
    auth.uid(),
    CASE WHEN admin_update_company_verification_details.is_verified THEN 'verify' ELSE 'unverify' END,
    CASE WHEN c.is_verified THEN 'verified' ELSE 'unverified' END,
    CASE WHEN admin_update_company_verification_details.is_verified THEN 'verified' ELSE 'unverified' END,
    'Admin verification status update'
  FROM companies c
  WHERE c.user_id = target_user_id;
END;
$function$;