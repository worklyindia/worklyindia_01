-- Fix the search path security issue for the newly created function
ALTER FUNCTION public.get_job_applicants_with_emails(uuid) SET search_path TO 'public';