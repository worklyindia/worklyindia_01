-- Update function to return IST (India Standard Time) server time
CREATE OR REPLACE FUNCTION public.get_server_time_ist()
RETURNS timestamp with time zone
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT now() AT TIME ZONE 'Asia/Kolkata';
$$;