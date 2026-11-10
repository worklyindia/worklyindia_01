-- Drop the existing function first
DROP FUNCTION IF EXISTS get_server_time_ist();

-- Create updated function that returns epoch milliseconds in IST
CREATE OR REPLACE FUNCTION get_server_time_ist()
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT EXTRACT(EPOCH FROM (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')) * 1000;
$$;