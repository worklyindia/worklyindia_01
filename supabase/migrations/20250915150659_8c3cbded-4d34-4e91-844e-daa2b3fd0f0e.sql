-- Fix security warnings by adding search_path to functions that don't have it

-- Update functions that are missing search_path parameter
ALTER FUNCTION public.update_employer_notification_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_edge_functions_updated_at() SET search_path = 'public';
ALTER FUNCTION public.check_duplicate_application() SET search_path = 'public';
ALTER FUNCTION public.expire_old_points() SET search_path = 'public';
ALTER FUNCTION public.update_conversation_timestamp() SET search_path = 'public';
ALTER FUNCTION public.clean_old_notifications() SET search_path = 'public';
ALTER FUNCTION public.trigger_notification_cleanup() SET search_path = 'public';
ALTER FUNCTION public.sync_job_application_count() SET search_path = 'public';
ALTER FUNCTION public.increment_job_counter(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.update_job_trending_score(uuid) SET search_path = 'public';
ALTER FUNCTION public.update_all_trending_scores() SET search_path = 'public';
ALTER FUNCTION public.activate_job_boost(uuid) SET search_path = 'public';
ALTER FUNCTION public.expire_job_boosts() SET search_path = 'public';
ALTER FUNCTION public.calculate_trending_score(uuid) SET search_path = 'public';
ALTER FUNCTION public.handle_new_employer() SET search_path = 'public';
ALTER FUNCTION public.sync_job_metrics(uuid) SET search_path = 'public';
ALTER FUNCTION public.assign_admin_role(uuid) SET search_path = 'public';
ALTER FUNCTION public.assign_user_role(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.is_admin(uuid) SET search_path = 'public';
ALTER FUNCTION public.create_job_application_notification() SET search_path = 'public';
ALTER FUNCTION public.get_user_role(uuid) SET search_path = 'public';
ALTER FUNCTION public.auto_mark_company_profile_complete() SET search_path = 'public';