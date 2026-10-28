-- Remove verification from all companies for testing
UPDATE companies
SET 
  is_verified = false,
  badge_color = NULL,
  verified_plan_start = NULL,
  verified_plan_end = NULL,
  updated_at = now()
WHERE is_verified = true;