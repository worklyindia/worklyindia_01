-- Drop the existing function and create the enhanced version
DROP FUNCTION IF EXISTS public.get_all_employers_enhanced(text,text,text,text,boolean,integer,integer);

CREATE OR REPLACE FUNCTION public.get_all_employers_enhanced(
  p_search text DEFAULT ''::text,
  p_location text DEFAULT ''::text,
  p_industry text DEFAULT ''::text,
  p_status text DEFAULT 'all'::text,
  p_show_deleted boolean DEFAULT false,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid,
  company_id uuid,
  company_name text,
  email text,
  phone text,
  location text,
  industry text,
  company_size text,
  organisation_size text,
  website text,
  description text,
  company_details text,
  logo_url text,
  is_verified boolean,
  is_profile_complete boolean,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  total_jobs integer,
  active_jobs integer,
  badge_color text,
  account_status text,
  account_status_reason text,
  job_posting_visibility boolean,
  verified_plan_start timestamp with time zone,
  verified_plan_end timestamp with time zone,
  business_type text,
  legal_name text,
  cin_number text,
  gst_number text,
  msme_number text,
  registered_address text,
  support_email text,
  hr_contact_name text,
  hr_contact text,
  interview_contact_details text,
  mission text,
  vision text,
  core_values text,
  services_description text,
  pricing_plans text,
  differentiating_factors text,
  founder_name text,
  founder_bio text,
  key_team_members text,
  clients_description text,
  testimonials text,
  data_privacy_measures text,
  refund_policy text,
  dispute_resolution text,
  instagram_link text,
  facebook_link text,
  youtube_link text,
  linkedin_link text,
  whatsapp_number text,
  whatsapp text,
  incorporation_date text,
  profile_views_count integer,
  precise_address text,
  city text,
  state text,
  country text,
  postal_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    COALESCE(c.organisation_size, '') as organisation_size,
    COALESCE(c.website, '') as website,
    COALESCE(c.description, '') as description,
    COALESCE(c.company_details, '') as company_details,
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
    COALESCE(c.badge_color, '') as badge_color,
    COALESCE(c.account_status, 'active') as account_status,
    COALESCE(c.account_status_reason, '') as account_status_reason,
    COALESCE(es.job_posting_visibility, true) as job_posting_visibility,
    c.verified_plan_start,
    c.verified_plan_end,
    COALESCE(c.business_type, '') as business_type,
    COALESCE(c.legal_name, '') as legal_name,
    COALESCE(c.cin_number, '') as cin_number,
    COALESCE(c.gst_number, '') as gst_number,
    COALESCE(c.msme_number, '') as msme_number,
    COALESCE(c.registered_address, '') as registered_address,
    COALESCE(c.support_email, '') as support_email,
    COALESCE(c.hr_contact_name, '') as hr_contact_name,
    COALESCE(c.hr_contact_name, '') as hr_contact,
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
    COALESCE(c.whatsapp_number, '') as whatsapp,
    COALESCE(c.incorporation_date::text, '') as incorporation_date,
    COALESCE(c.profile_views_count, 0) as profile_views_count,
    COALESCE(c.precise_address, '') as precise_address,
    COALESCE(c.city, '') as city,
    COALESCE(c.state, '') as state,
    COALESCE(c.country, '') as country,
    COALESCE(c.postal_code, '') as postal_code
  FROM public.companies c
  LEFT JOIN auth.users au ON au.id = c.user_id
  LEFT JOIN public.employer_settings es ON es.user_id = c.user_id
  WHERE 
    (NOT p_show_deleted AND COALESCE(c.account_status, 'active') != 'deleted') OR
    (p_show_deleted AND COALESCE(c.account_status, 'active') = 'deleted')
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
$function$