-- Fix: Set explicit search_path for public functions to prevent schema hijacking
-- This migration adds SET search_path = public on affected functions flagged by linter

ALTER FUNCTION public.calculate_organic_score(p_views_count integer, p_applications_count integer)
  SET search_path = public;

ALTER FUNCTION public.calculate_trending_score()
  SET search_path = public;

ALTER FUNCTION public.calculate_trending_score_v2(p_job_id uuid)
  SET search_path = public;

ALTER FUNCTION public.ensure_single_most_popular()
  SET search_path = public;

ALTER FUNCTION public.fuzzy_search_jobs(
  search_query text,
  job_location text,
  job_type_filter text,
  experience_filter text,
  salary_min integer,
  salary_max integer,
  category_filter text,
  page_size integer,
  page_offset integer,
  sort_by text,
  languages_filter text
)
  SET search_path = public;

ALTER FUNCTION public.generate_certificate_number()
  SET search_path = public;

ALTER FUNCTION public.get_job_categories_stats()
  SET search_path = public;

ALTER FUNCTION public.get_latest_company_for_user(p_user_id uuid)
  SET search_path = public;

ALTER FUNCTION public.get_search_suggestions(query_text text, limit_count integer)
  SET search_path = public;

ALTER FUNCTION public.get_server_time_ist()
  SET search_path = public;

ALTER FUNCTION public.get_unread_notifications_count(user_uuid uuid)
  SET search_path = public;

ALTER FUNCTION public.search_jobs(
  search_query text,
  job_location text,
  job_type_filter text,
  experience_filter text,
  salary_min integer,
  salary_max integer,
  category_filter text,
  page_size integer,
  page_offset integer
)
  SET search_path = public;

ALTER FUNCTION public.set_job_country_default()
  SET search_path = public;

ALTER FUNCTION public.set_job_expiry()
  SET search_path = public;

ALTER FUNCTION public.update_company_review_timestamp()
  SET search_path = public;

ALTER FUNCTION public.update_contact_information_updated_at()
  SET search_path = public;

ALTER FUNCTION public.update_push_notification_preferences_timestamp()
  SET search_path = public;

ALTER FUNCTION public.update_referral_payment_settings_updated_at()
  SET search_path = public;

ALTER FUNCTION public.update_reply_updated_at()
  SET search_path = public;

ALTER FUNCTION public.update_site_settings_updated_at()
  SET search_path = public;