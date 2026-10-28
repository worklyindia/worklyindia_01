-- Remove problematic triggers that might be making HTTP calls
-- This will fix the net.http_post error during job creation

-- Drop the trigger that's causing HTTP calls
DROP TRIGGER IF EXISTS notify_new_job ON public.jobs;

-- Recreate the function without HTTP calls or make it simpler
CREATE OR REPLACE FUNCTION public.create_new_job_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Simply return NEW without making any HTTP calls
    -- Job notifications can be handled differently if needed
    RETURN NEW;
END;
$$;

-- Only recreate the trigger if we want job notifications (optional)
-- For now, we'll skip it to avoid any HTTP call issues
-- CREATE TRIGGER notify_new_job 
--   AFTER INSERT ON public.jobs 
--   FOR EACH ROW EXECUTE FUNCTION create_new_job_notifications();