-- Update the admin_update_company_ban_status function to keep existing jobs visible
CREATE OR REPLACE FUNCTION public.admin_update_company_ban_status(target_user_id uuid, new_status text, ban_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Handle employer settings based on ban/unban
  IF new_status = 'banned' THEN
    -- When banning: disable job posting visibility (prevents new job posts)
    -- But DO NOT change existing job statuses - they remain visible
    UPDATE employer_settings SET
      job_posting_visibility = false,
      updated_at = now()
    WHERE user_id = target_user_id;
      
  ELSIF new_status = 'active' THEN
    -- When unbanning: re-enable job posting visibility
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
$function$