-- Create function to check account status before job application
CREATE OR REPLACE FUNCTION public.check_account_status_before_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_account_status text;
BEGIN
  -- Get user's account status
  SELECT account_status INTO user_account_status
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  -- Check if user is banned from applying to jobs
  IF user_account_status = 'job_banned' THEN
    RAISE EXCEPTION 'You are banned from applying to jobs. Please contact support for assistance.';
  END IF;
  
  -- Check if user is completely banned
  IF user_account_status = 'banned' THEN
    RAISE EXCEPTION 'Your account is banned. Please contact support for assistance.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to check account status before job application
DROP TRIGGER IF EXISTS check_account_status_trigger ON public.job_applications;
CREATE TRIGGER check_account_status_trigger
  BEFORE INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_account_status_before_application();