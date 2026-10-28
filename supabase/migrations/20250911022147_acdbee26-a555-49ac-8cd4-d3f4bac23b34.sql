-- Drop existing functions first
DROP FUNCTION IF EXISTS public.admin_set_account_status(uuid,text,text);
DROP FUNCTION IF EXISTS public.admin_set_job_posting_visibility(uuid,boolean);
DROP FUNCTION IF EXISTS public.admin_update_company_profile(uuid,jsonb);

-- Create the missing admin_update_company_verification_details function
CREATE OR REPLACE FUNCTION public.admin_update_company_verification_details(
  p_company_id UUID,
  p_is_verified BOOLEAN,
  p_badge_color TEXT DEFAULT NULL,
  p_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS VOID
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
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update company verification details
  UPDATE public.companies 
  SET 
    is_verified = p_is_verified,
    badge_color = CASE WHEN p_is_verified THEN p_badge_color ELSE NULL END,
    verified_plan_start = CASE WHEN p_is_verified THEN p_start ELSE NULL END,
    verified_plan_end = CASE WHEN p_is_verified THEN p_end ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found with ID: %', p_company_id;
  END IF;
END;
$$;

-- Create function to handle job visibility based on employer status and settings
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  p_user_id UUID,
  p_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
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
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update company account status
  UPDATE public.companies 
  SET 
    account_status = p_status,
    account_status_reason = p_reason,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- If banning the employer, hide all their jobs
  IF p_status = 'banned' THEN
    UPDATE public.jobs 
    SET 
      visibility = 'private',
      status = 'inactive',
      updated_at = NOW()
    WHERE company_id IN (
      SELECT id FROM public.companies WHERE user_id = p_user_id
    );
  -- If unbanning the employer, restore their jobs visibility
  ELSIF p_status = 'active' THEN
    -- Only restore jobs to public if employer settings allow job posting
    UPDATE public.jobs 
    SET 
      visibility = CASE 
        WHEN EXISTS (
          SELECT 1 FROM public.employer_settings es 
          WHERE es.user_id = p_user_id 
          AND es.job_posting_visibility = true
        ) THEN 'public'
        ELSE 'private'
      END,
      status = 'active',
      updated_at = NOW()
    WHERE company_id IN (
      SELECT id FROM public.companies WHERE user_id = p_user_id
    ) AND status = 'inactive';
  END IF;
END;
$$;

-- Create function to handle job posting visibility toggle
CREATE OR REPLACE FUNCTION public.admin_set_job_posting_visibility(
  p_user_id UUID,
  p_visible BOOLEAN
)
RETURNS VOID
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
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Update employer settings
  INSERT INTO public.employer_settings (user_id, job_posting_visibility)
  VALUES (p_user_id, p_visible)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    job_posting_visibility = p_visible,
    updated_at = NOW();

  -- Update job visibility based on the setting and company status
  UPDATE public.jobs 
  SET 
    visibility = CASE 
      WHEN p_visible AND EXISTS (
        SELECT 1 FROM public.companies c 
        WHERE c.id = jobs.company_id 
        AND c.user_id = p_user_id 
        AND c.account_status = 'active'
      ) THEN 'public'
      ELSE 'private'
    END,
    updated_at = NOW()
  WHERE company_id IN (
    SELECT id FROM public.companies WHERE user_id = p_user_id
  );
END;
$$;