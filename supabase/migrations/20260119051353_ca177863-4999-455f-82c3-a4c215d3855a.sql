-- Fix: Remove hardcoded email override from activate_company_verification
-- Now all users will get the correct badge_color and expiry from their selected package

CREATE OR REPLACE FUNCTION public.activate_company_verification(
  p_company_id uuid,
  p_package_id uuid,
  p_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_package RECORD;
  v_company RECORD;
  v_expire_at timestamptz;
  v_badge_color text;
BEGIN
  -- Get the selected package details
  SELECT * INTO v_package
  FROM verification_packages
  WHERE id = p_package_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive package'
    );
  END IF;
  
  -- Get company details
  SELECT * INTO v_company
  FROM companies
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Company not found'
    );
  END IF;
  
  -- Calculate expiry based on package validity_days
  -- If validity_days is 0 or NULL, it means lifetime (set to 2099-12-31)
  -- Otherwise, add validity_days to current timestamp
  IF v_package.validity_days IS NULL OR v_package.validity_days = 0 THEN
    v_expire_at := '2099-12-31 23:59:59'::timestamptz;
  ELSE
    v_expire_at := now() + (v_package.validity_days || ' days')::interval;
  END IF;
  
  -- Use the badge color from the selected package
  v_badge_color := COALESCE(v_package.badge_color, 'green');
  
  -- Update company verification status with correct package details
  UPDATE companies
  SET 
    is_verified = true,
    badge_color = v_badge_color,
    verified_plan_start = now(),
    verified_plan_end = v_expire_at,
    updated_at = now()
  WHERE id = p_company_id;
  
  -- Log the verification activation
  INSERT INTO admin_audit_logs (
    action,
    action_type,
    target_type,
    target_id,
    performed_by,
    details
  ) VALUES (
    'verification_activated',
    'verification',
    'company',
    p_company_id::text,
    v_company.user_id::text,
    jsonb_build_object(
      'package_id', p_package_id,
      'package_name', v_package.name,
      'badge_color', v_badge_color,
      'validity_days', v_package.validity_days,
      'expire_at', v_expire_at,
      'payment_id', p_payment_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification activated successfully',
    'badge_color', v_badge_color,
    'expire_at', v_expire_at,
    'package_name', v_package.name
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.activate_company_verification(uuid, uuid, text) TO authenticated;