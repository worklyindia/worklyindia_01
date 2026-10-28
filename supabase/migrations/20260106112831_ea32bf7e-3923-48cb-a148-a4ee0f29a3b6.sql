
-- Drop and recreate increment_quota_usage with correct return type
DROP FUNCTION IF EXISTS increment_quota_usage(integer);

-- Recreate with integer return type
CREATE OR REPLACE FUNCTION increment_quota_usage(increment_by integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  new_quota_used INTEGER;
BEGIN
  -- Ensure today's record exists first
  INSERT INTO indexing_daily_quota (date, quota_used, quota_limit, indexnow_fallback_count)
  VALUES (today, 0, 200, 0)
  ON CONFLICT (date) DO NOTHING;
  
  -- Then increment and return new value
  UPDATE indexing_daily_quota 
  SET quota_used = quota_used + increment_by,
      updated_at = NOW()
  WHERE date = today
  RETURNING quota_used INTO new_quota_used;
  
  RETURN new_quota_used;
END;
$$;

-- Add function to get remaining quota
CREATE OR REPLACE FUNCTION get_remaining_quota()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  quota_record indexing_daily_quota;
  effective_limit INTEGER := 180; -- Keep 20 buffer
BEGIN
  quota_record := get_or_create_daily_quota();
  RETURN GREATEST(0, effective_limit - quota_record.quota_used);
END;
$$;
