-- Create function to get server time
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamp with time zone
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT now();
$$;