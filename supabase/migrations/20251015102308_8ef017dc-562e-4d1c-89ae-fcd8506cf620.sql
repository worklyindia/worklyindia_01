-- Drop the existing function with incorrect timezone conversion
DROP FUNCTION IF EXISTS get_server_time_ist();

-- Create corrected function that returns proper UTC epoch milliseconds
-- The JavaScript Date object will interpret this correctly and formatInTimeZone will convert to IST for display
CREATE OR REPLACE FUNCTION get_server_time_ist()
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT EXTRACT(EPOCH FROM NOW()) * 1000;
$$;