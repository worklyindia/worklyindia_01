-- Create trigger to automatically create company profile for new employer users
CREATE OR REPLACE FUNCTION public.handle_new_employer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only create company profile if user has employer role or creates their first job
  INSERT INTO public.companies (user_id, company_name, is_profile_complete)
  VALUES (NEW.user_id, 'My Company', false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$

-- Create trigger on jobs table to auto-create company when first job is posted
CREATE TRIGGER on_first_job_created
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_employer();