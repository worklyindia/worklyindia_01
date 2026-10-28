-- Drop existing function and recreate with correct signature
DROP FUNCTION IF EXISTS increment_quota_usage(integer);

-- Function to increment quota usage atomically
CREATE OR REPLACE FUNCTION increment_quota_usage(increment_by INTEGER DEFAULT 1)
RETURNS void AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO indexing_daily_quota (date, quota_used, quota_limit)
  VALUES (today, increment_by, 200)
  ON CONFLICT (date) DO UPDATE
  SET quota_used = indexing_daily_quota.quota_used + increment_by,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to reschedule remaining pending items to next day
CREATE OR REPLACE FUNCTION reschedule_pending_to_next_day()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE google_indexing_queue
  SET scheduled_for = get_next_midnight_ist()
  WHERE status = 'pending'
    AND (scheduled_for IS NULL OR scheduled_for <= NOW())
    AND queue_position IS NOT NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;