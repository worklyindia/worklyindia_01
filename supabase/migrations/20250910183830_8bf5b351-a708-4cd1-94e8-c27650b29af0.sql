-- Drop existing functions to recreate with correct signatures
DROP FUNCTION IF EXISTS get_all_employers_enhanced(text,text,text,text,integer,integer);

-- Create comprehensive admin functions for employer management

-- Function to get all employers with enhanced data
CREATE OR REPLACE FUNCTION get_all_employers_enhanced(
  p_search TEXT DEFAULT '',
  p_location TEXT DEFAULT '',
  p_industry TEXT DEFAULT '',
  p_status TEXT DEFAULT 'all',
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  user_id UUID,
  company_id UUID,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  industry TEXT,
  company_size TEXT,
  website TEXT,
  description TEXT,
  logo_url TEXT,
  is_verified BOOLEAN,
  is_profile_complete BOOLEAN,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  total_jobs INTEGER,
  active_jobs INTEGER,
  badge_color TEXT,
  account_status TEXT,
  account_status_reason TEXT,
  job_posting_visibility BOOLEAN,
  verified_plan_start TIMESTAMPTZ,
  verified_plan_end TIMESTAMPTZ,
  -- Additional comprehensive fields
  business_type TEXT,
  legal_name TEXT,
  cin_number TEXT,
  gst_number TEXT,
  msme_number TEXT,
  registered_address TEXT,
  support_email TEXT,
  hr_contact_name TEXT,
  interview_contact_details TEXT,
  mission TEXT,
  vision TEXT,
  core_values TEXT,
  services_description TEXT,
  pricing_plans TEXT,
  differentiating_factors TEXT,
  founder_name TEXT,
  founder_bio TEXT,
  key_team_members TEXT,
  clients_description TEXT,
  testimonials TEXT,
  data_privacy_measures TEXT,
  refund_policy TEXT,
  dispute_resolution TEXT,
  instagram_link TEXT,
  facebook_link TEXT,
  youtube_link TEXT,
  linkedin_link TEXT,
  whatsapp_number TEXT,
  incorporation_date DATE,
  profile_views_count INTEGER,
  precise_address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  company_details TEXT,
  organisation_size TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au 
    WHERE au.user_id = auth.uid() 
    AND au.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    c.user_id,
    c.id as company_id,
    COALESCE(c.company_name, '') as company_name,
    COALESCE(c.email, '') as email,
    COALESCE(c.phone, '') as phone,
    COALESCE(c.location, '') as location,
    COALESCE(c.industry, '') as industry,
    COALESCE(c.company_size, '') as company_size,
    COALESCE(c.website, '') as website,
    COALESCE(c.description, '') as description,
    COALESCE(c.logo_url, '') as logo_url,
    COALESCE(c.is_verified, false) as is_verified,
    COALESCE(c.is_profile_complete, false) as is_profile_complete,
    c.created_at,
    au.last_sign_in_at,
    COALESCE(
      (SELECT COUNT(*)::integer FROM jobs j WHERE j.company_id = c.id), 
      0
    ) as total_jobs,
    COALESCE(
      (SELECT COUNT(*)::integer FROM jobs j WHERE j.company_id = c.id AND j.status = 'active'), 
      0
    ) as active_jobs,
    c.badge_color,
    COALESCE(c.account_status, 'active') as account_status,
    c.account_status_reason,
    COALESCE(es.job_posting_visibility, true) as job_posting_visibility,
    c.verified_plan_start,
    c.verified_plan_end,
    -- Additional comprehensive fields
    COALESCE(c.business_type, '') as business_type,
    COALESCE(c.legal_name, '') as legal_name,
    COALESCE(c.cin_number, '') as cin_number,
    COALESCE(c.gst_number, '') as gst_number,
    COALESCE(c.msme_number, '') as msme_number,
    COALESCE(c.registered_address, '') as registered_address,
    COALESCE(c.support_email, '') as support_email,
    COALESCE(c.hr_contact_name, '') as hr_contact_name,
    COALESCE(c.interview_contact_details, '') as interview_contact_details,
    COALESCE(c.mission, '') as mission,
    COALESCE(c.vision, '') as vision,
    COALESCE(c.core_values, '') as core_values,
    COALESCE(c.services_description, '') as services_description,
    COALESCE(c.pricing_plans, '') as pricing_plans,
    COALESCE(c.differentiating_factors, '') as differentiating_factors,
    COALESCE(c.founder_name, '') as founder_name,
    COALESCE(c.founder_bio, '') as founder_bio,
    COALESCE(c.key_team_members, '') as key_team_members,
    COALESCE(c.clients_description, '') as clients_description,
    COALESCE(c.testimonials, '') as testimonials,
    COALESCE(c.data_privacy_measures, '') as data_privacy_measures,
    COALESCE(c.refund_policy, '') as refund_policy,
    COALESCE(c.dispute_resolution, '') as dispute_resolution,
    COALESCE(c.instagram_link, '') as instagram_link,
    COALESCE(c.facebook_link, '') as facebook_link,
    COALESCE(c.youtube_link, '') as youtube_link,
    COALESCE(c.linkedin_link, '') as linkedin_link,
    COALESCE(c.whatsapp_number, '') as whatsapp_number,
    c.incorporation_date,
    COALESCE(c.profile_views_count, 0) as profile_views_count,
    COALESCE(c.precise_address, '') as precise_address,
    COALESCE(c.city, '') as city,
    COALESCE(c.state, '') as state,
    COALESCE(c.country, '') as country,
    COALESCE(c.postal_code, '') as postal_code,
    COALESCE(c.company_details, '') as company_details,
    COALESCE(c.organisation_size, '') as organisation_size
  FROM public.companies c
  LEFT JOIN auth.users au ON au.id = c.user_id
  LEFT JOIN public.employer_settings es ON es.user_id = c.user_id
  WHERE 
    c.account_status != 'deleted'
    AND (p_search = '' OR (
      c.company_name ILIKE '%' || p_search || '%' OR
      c.email ILIKE '%' || p_search || '%' OR
      c.description ILIKE '%' || p_search || '%'
    ))
    AND (p_location = '' OR c.location ILIKE '%' || p_location || '%')
    AND (p_industry = '' OR c.industry ILIKE '%' || p_industry || '%')
    AND (p_status = 'all' OR 
         (p_status = 'active' AND au.last_sign_in_at > NOW() - INTERVAL '30 days') OR
         (p_status = 'inactive' AND (au.last_sign_in_at IS NULL OR au.last_sign_in_at <= NOW() - INTERVAL '30 days')))
  ORDER BY c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;