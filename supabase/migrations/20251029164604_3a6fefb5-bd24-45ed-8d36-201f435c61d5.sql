-- Fix all remaining SECURITY DEFINER functions by adding SET search_path = public
-- This prevents search_path manipulation attacks

-- 1. admin_update_company_profile
ALTER FUNCTION public.admin_update_company_profile(
  company_id uuid,
  company_name text,
  legal_name text,
  business_type text,
  organisation_size text,
  industry text,
  email text,
  phone text,
  whatsapp_number text,
  hr_contact_name text,
  website text,
  precise_address text,
  city text,
  state text,
  country text,
  postal_code text,
  instagram_link text,
  facebook_link text,
  youtube_link text,
  linkedin_link text,
  cin_number text,
  gst_number text,
  msme_number text,
  pan_number text,
  incorporation_date date,
  refund_policy text,
  dispute_resolution text,
  data_privacy_measures text,
  rbi_compliance text,
  company_details text,
  services_description text,
  differentiating_factors text,
  testimonials text,
  clients_description text,
  pricing_plans text,
  logo_url text
) SET search_path = public;

-- 2. ensure_referral_wallet
ALTER FUNCTION public.ensure_referral_wallet() SET search_path = public;

-- 3. get_public_jobs  
ALTER FUNCTION public.get_public_jobs(job_limit integer) SET search_path = public;

-- 4. get_recommended_jobs
ALTER FUNCTION public.get_recommended_jobs(u_id uuid) SET search_path = public;

-- 5 & 6. get_trending_jobs_optimized_v2 (both overloads)
ALTER FUNCTION public.get_trending_jobs_optimized_v2(
  p_user_id uuid,
  p_limit integer,
  p_offset integer
) SET search_path = public;

ALTER FUNCTION public.get_trending_jobs_optimized_v2(
  p_limit integer,
  p_offset integer
) SET search_path = public;

-- 7. get_trending_jobs_with_ranks
ALTER FUNCTION public.get_trending_jobs_with_ranks(
  p_user_id uuid,
  p_limit integer,
  p_offset integer
) SET search_path = public;

-- 8. get_unread_applicants_per_job
ALTER FUNCTION public.get_unread_applicants_per_job(p_employer_id uuid) SET search_path = public;

-- 9. mark_job_applicants_viewed
ALTER FUNCTION public.mark_job_applicants_viewed(
  p_job_id uuid,
  p_employer_id uuid
) SET search_path = public;

-- 10. reorder_packages
ALTER FUNCTION public.reorder_packages(
  package_table_name text,
  package_ids uuid[],
  new_orders integer[]
) SET search_path = public;

-- 11. search_jobs_by_id
ALTER FUNCTION public.search_jobs_by_id(search_term text) SET search_path = public;

-- 12. trigger_update_organic_ranks
ALTER FUNCTION public.trigger_update_organic_ranks() SET search_path = public;

-- 13. trigger_update_trending_ranks
ALTER FUNCTION public.trigger_update_trending_ranks() SET search_path = public;

-- 14. update_all_trending_scores
ALTER FUNCTION public.update_all_trending_scores() SET search_path = public;

-- 15. update_organic_ranks
ALTER FUNCTION public.update_organic_ranks() SET search_path = public;

-- 16. update_referral_counts
ALTER FUNCTION public.update_referral_counts() SET search_path = public;

-- 17. update_trending_ranks
ALTER FUNCTION public.update_trending_ranks() SET search_path = public;

-- Add comment
COMMENT ON SCHEMA public IS 'All SECURITY DEFINER functions now protected with SET search_path = public to prevent search_path manipulation attacks';