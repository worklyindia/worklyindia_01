-- Drop existing functions if they exist and recreate with proper signatures
DROP FUNCTION IF EXISTS admin_delete_company_complete(uuid, text);
DROP FUNCTION IF EXISTS admin_update_company_ban_status(uuid, text, text);
DROP FUNCTION IF EXISTS admin_update_company_verification_details(uuid, boolean, text, timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS admin_update_company_profile(uuid, jsonb);

-- Function to handle company ban/unban with job status management
CREATE OR REPLACE FUNCTION admin_update_company_ban_status(
  target_user_id UUID,
  new_status TEXT,
  ban_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_record RECORD;
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get company record
  SELECT * INTO company_record FROM companies WHERE user_id = target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user_id: %', target_user_id;
  END IF;

  -- Update company status
  UPDATE companies SET
    account_status = new_status,
    account_status_reason = COALESCE(ban_reason, account_status_reason),
    updated_at = now()
  WHERE user_id = target_user_id;

  -- Handle job status changes based on ban/unban
  IF new_status = 'banned' THEN
    -- When banning: make all active jobs inactive
    UPDATE jobs SET 
      status = 'inactive',
      updated_at = now()
    WHERE company_id = company_record.id 
      AND status = 'active';
      
    -- Disable job posting visibility
    UPDATE employer_settings SET
      job_posting_visibility = false,
      updated_at = now()
    WHERE user_id = target_user_id;
      
  ELSIF new_status = 'active' THEN
    -- When unbanning: reactivate all jobs that were previously active
    UPDATE jobs SET 
      status = 'active',
      updated_at = now()
    WHERE company_id = company_record.id 
      AND status = 'inactive'
      AND expires_at > now(); -- Only reactivate non-expired jobs
      
    -- Re-enable job posting visibility
    UPDATE employer_settings SET
      job_posting_visibility = true,
      updated_at = now()
    WHERE user_id = target_user_id;
  END IF;

  -- Log the action
  INSERT INTO company_audit_logs (
    company_id, admin_id, action, old_status, new_status, reason
  ) VALUES (
    company_record.id, auth.uid(), 
    CASE WHEN new_status = 'banned' THEN 'ban' ELSE 'unban' END,
    company_record.account_status, new_status, ban_reason
  );
END;
$$;

-- Function for complete company deletion with all related data
CREATE OR REPLACE FUNCTION admin_delete_company_complete(
  target_user_id UUID,
  deletion_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_record RECORD;
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get company record
  SELECT * INTO company_record FROM companies WHERE user_id = target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user_id: %', target_user_id;
  END IF;

  -- Log deletion action before deleting
  INSERT INTO company_audit_logs (
    company_id, admin_id, action, old_status, new_status, reason
  ) VALUES (
    company_record.id, auth.uid(), 'delete', 
    company_record.account_status, 'deleted', deletion_reason
  );

  -- Delete all related data in proper order to avoid foreign key violations
  
  -- 1. Delete job applications for this company's jobs
  DELETE FROM job_applications 
  WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  
  -- 2. Delete job interactions for this company's jobs  
  DELETE FROM job_interactions 
  WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  
  -- 3. Delete job boosts for this company's jobs
  DELETE FROM job_boosts 
  WHERE job_id IN (SELECT id FROM jobs WHERE company_id = company_record.id);
  
  -- 4. Delete job payments made by this user
  DELETE FROM job_payments WHERE user_id = target_user_id;
  
  -- 5. Delete all jobs posted by this company
  DELETE FROM jobs WHERE company_id = company_record.id;
  
  -- 6. Delete conversations where this user is the employer
  DELETE FROM conversations WHERE employer_id = target_user_id;
  
  -- 7. Delete employer notifications
  DELETE FROM employer_notifications WHERE user_id = target_user_id;
  
  -- 8. Delete employer settings
  DELETE FROM employer_settings WHERE user_id = target_user_id;
  
  -- 9. Delete company reviews
  DELETE FROM company_reviews WHERE company_id = company_record.id;
  
  -- 10. Delete company statistics  
  DELETE FROM company_statistics WHERE company_id = company_record.id;
  
  -- 11. Delete company favorites
  DELETE FROM company_favorites WHERE company_id = company_record.id;
  
  -- 12. Delete verification purchases
  DELETE FROM verification_purchases WHERE user_id = target_user_id;
  
  -- 13. Delete referral codes
  DELETE FROM referral_codes WHERE user_id = target_user_id;
  
  -- 14. Delete referral commissions (as referrer)
  DELETE FROM referral_commissions WHERE referrer_id = target_user_id;
  
  -- 15. Delete user referrals (as referrer)
  DELETE FROM user_referrals WHERE referrer_id = target_user_id;
  
  -- 16. Delete notification tokens
  DELETE FROM user_notification_tokens WHERE user_id = target_user_id;
  
  -- 17. Delete wallet and transactions
  DELETE FROM transactions WHERE user_id = target_user_id;
  DELETE FROM points_transactions WHERE user_id = target_user_id;
  DELETE FROM point_adjustments WHERE user_id = target_user_id;
  DELETE FROM wallets WHERE user_id = target_user_id;
  
  -- 18. Finally delete the company record
  DELETE FROM companies WHERE user_id = target_user_id;
  
  -- Note: We don't delete the auth.users record as that's managed by Supabase Auth
END;
$$;

-- Function to update company verification details (enhanced)
CREATE OR REPLACE FUNCTION admin_update_company_verification_details(
  target_user_id UUID,
  is_verified BOOLEAN,
  badge_color TEXT DEFAULT NULL,
  verified_plan_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  verified_plan_end TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update company verification
  UPDATE companies SET
    is_verified = is_verified,
    badge_color = CASE WHEN is_verified THEN badge_color ELSE NULL END,
    verified_plan_start = CASE WHEN is_verified THEN verified_plan_start ELSE NULL END,
    verified_plan_end = CASE WHEN is_verified THEN verified_plan_end ELSE NULL END,
    updated_at = now()
  WHERE user_id = target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user_id: %', target_user_id;
  END IF;
END;
$$;

-- Function to update company profile with comprehensive fields
CREATE OR REPLACE FUNCTION admin_update_company_profile(
  target_user_id UUID,
  profile_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_record RECORD;
BEGIN
  -- Check admin permissions
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get current company record
  SELECT * INTO company_record FROM companies WHERE user_id = target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user_id: %', target_user_id;
  END IF;

  -- Update company profile with provided data
  UPDATE companies SET
    company_name = COALESCE(profile_data->>'company_name', company_name),
    email = COALESCE(profile_data->>'email', email),
    phone = COALESCE(profile_data->>'phone', phone),
    whatsapp_number = COALESCE(profile_data->>'whatsapp_number', whatsapp_number),
    location = COALESCE(profile_data->>'location', location),
    precise_address = COALESCE(profile_data->>'precise_address', precise_address),
    city = COALESCE(profile_data->>'city', city),
    state = COALESCE(profile_data->>'state', state),
    country = COALESCE(profile_data->>'country', country),
    postal_code = COALESCE(profile_data->>'postal_code', postal_code),
    website = COALESCE(profile_data->>'website', website),
    industry = COALESCE(profile_data->>'industry', industry),
    company_size = COALESCE(profile_data->>'company_size', company_size),
    description = COALESCE(profile_data->>'description', description),
    legal_name = COALESCE(profile_data->>'legal_name', legal_name),
    hr_contact_name = COALESCE(profile_data->>'hr_contact_name', hr_contact_name),
    updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;