
-- Reset today's quota to actual count of Google API submissions
-- (Only count submissions where indexnow_submitted = false, meaning Google API was used)
UPDATE indexing_daily_quota 
SET quota_used = (
  SELECT COALESCE(COUNT(*), 0)
  FROM google_indexing_queue 
  WHERE status = 'completed' 
    AND processed_at >= CURRENT_DATE
    AND processed_at < CURRENT_DATE + INTERVAL '1 day'
    AND indexnow_submitted = false
),
updated_at = NOW(),
last_reset_at = NOW()
WHERE date = CURRENT_DATE;
