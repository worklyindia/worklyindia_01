-- Grant lifetime verification to gohilvishal7600@gmail.com
UPDATE companies 
SET 
  is_verified = true,
  verified_plan_start = NOW(),
  verified_plan_end = '2099-12-31 23:59:59+00'::timestamp with time zone,
  badge_color = 'gold',
  updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email = 'gohilvishal7600@gmail.com'
);

-- Update the activate_company_verification function to handle lifetime verification
CREATE OR REPLACE FUNCTION public.activate_company_verification(p_user_id uuid, p_verification_package_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  package_record RECORD;
  user_email TEXT;
BEGIN
  -- Get user email to check for special lifetime access
  SELECT email INTO user_email FROM auth.users WHERE id = p_user_id;
  
  -- Check if this is the special lifetime account
  IF user_email = 'gohilvishal7600@gmail.com' THEN
    -- Grant lifetime verification
    UPDATE companies SET
      is_verified = true,
      verified_plan_start = NOW(),
      verified_plan_end = '2099-12-31 23:59:59+00'::timestamp with time zone,
      badge_color = 'gold',
      updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN;
  END IF;
  
  -- Normal verification flow for other users
  SELECT * INTO package_record FROM verification_packages WHERE id = p_verification_package_id;
  
  IF package_record.id IS NULL THEN
    RAISE EXCEPTION 'Verification package not found';
  END IF;
  
  -- Update company verification status
  UPDATE companies SET
    is_verified = true,
    verified_plan_start = NOW(),
    verified_plan_end = NOW() + (package_record.validity_days || ' days')::INTERVAL,
    badge_color = package_record.badge_color,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Mark purchase as active
  UPDATE verification_purchases SET
    status = 'active',
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND verification_package_id = p_verification_package_id
    AND status = 'pending';
END;
$function$;