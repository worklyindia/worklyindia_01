-- Create missing admin functions for employer management

-- Function to update company verification details
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

  -- Update company verification
  UPDATE public.companies 
  SET 
    is_verified = p_is_verified,
    badge_color = CASE WHEN p_is_verified THEN p_badge_color ELSE NULL END,
    verified_plan_start = CASE WHEN p_is_verified THEN p_start ELSE NULL END,
    verified_plan_end = CASE WHEN p_is_verified THEN p_end ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;
END;
$$;

-- Function to set job posting visibility
CREATE OR REPLACE FUNCTION public.admin_set_job_posting_visibility(
  p_user_id uuid,
  p_visible boolean
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
    RAISE EXCEPTION 'Admin role required to set job posting visibility';
  END IF;

  -- Insert or update employer settings
  INSERT INTO public.employer_settings (
    user_id, 
    job_posting_visibility,
    new_applications,
    interview_reminders,
    weekly_reports,
    job_expiry_alerts,
    boost_notifications,
    email_notifications,
    push_notifications,
    sms_notifications,
    company_visibility,
    contact_visibility,
    logo_visibility,
    show_in_directory,
    allow_direct_contact
  ) VALUES (
    p_user_id, 
    p_visible,
    true, true, true, true, true, true, true, false,
    true, true, true, true, true
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    job_posting_visibility = p_visible,
    updated_at = NOW();
END;
$$;

-- Function to set account status
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  p_user_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
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
    RAISE EXCEPTION 'Admin role required to set account status';
  END IF;

  -- Update company account status
  UPDATE public.companies 
  SET 
    account_status = p_status,
    account_status_reason = p_reason,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found for user';
  END IF;

  -- Also create employer_settings if missing
  INSERT INTO public.employer_settings (
    user_id,
    job_posting_visibility,
    new_applications,
    interview_reminders,
    weekly_reports,
    job_expiry_alerts,
    boost_notifications,
    email_notifications,
    push_notifications,
    sms_notifications,
    company_visibility,
    contact_visibility,
    logo_visibility,
    show_in_directory,
    allow_direct_contact
  ) VALUES (
    p_user_id,
    CASE WHEN p_status = 'active' THEN true ELSE false END,
    true, true, true, true, true, true, true, false,
    true, true, true, true, true
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    job_posting_visibility = CASE WHEN p_status = 'active' THEN excluded.job_posting_visibility ELSE false END,
    updated_at = NOW();
END;
$$;

-- Create missing employer_settings records for all companies
INSERT INTO public.employer_settings (
  user_id,
  job_posting_visibility,
  new_applications,
  interview_reminders,
  weekly_reports,
  job_expiry_alerts,
  boost_notifications,
  email_notifications,
  push_notifications,
  sms_notifications,
  company_visibility,
  contact_visibility,
  logo_visibility,
  show_in_directory,
  allow_direct_contact
)
SELECT 
  c.user_id,
  CASE WHEN c.account_status = 'active' THEN true ELSE false END,
  true, true, true, true, true, true, true, false,
  true, true, true, true, true
FROM public.companies c
LEFT JOIN public.employer_settings es ON c.user_id = es.user_id
WHERE es.user_id IS NULL;