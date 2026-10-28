-- ================================================
-- GOOGLE INDEXING SYSTEM - ENHANCED SCHEMA
-- Implements: 1-by-1 processing, smart scheduling, 24hr verification
-- ================================================

-- 1. Add new columns to google_indexing_queue for smart date scheduling
ALTER TABLE google_indexing_queue 
ADD COLUMN IF NOT EXISTS original_created_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS calculated_process_datetime timestamptz,
ADD COLUMN IF NOT EXISTS queue_date date,
ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
ADD COLUMN IF NOT EXISTS last_processed_at timestamptz;

-- 2. Add verification tracking columns to job_indexing_status
ALTER TABLE job_indexing_status
ADD COLUMN IF NOT EXISTS next_verification_at timestamptz,
ADD COLUMN IF NOT EXISTS verification_attempt_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_verification_attempts integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS content_hash text,
ADD COLUMN IF NOT EXISTS last_content_change_at timestamptz;

-- 3. Create function to calculate queue position and scheduled date
CREATE OR REPLACE FUNCTION calculate_google_queue_position()
RETURNS TRIGGER AS $$
DECLARE
  current_pending_count INTEGER;
  daily_limit INTEGER := 180;
  days_to_add INTEGER;
  base_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get count of pending items ahead in queue
  SELECT COUNT(*) INTO current_pending_count
  FROM google_indexing_queue
  WHERE status = 'pending'
    AND retry_count < 5
    AND queue_position < COALESCE(NEW.queue_position, 999999999);
  
  -- Calculate which day this job will be processed
  days_to_add := FLOOR(current_pending_count / daily_limit) + 1;
  
  -- Set queue_date (when this job should be processed)
  NEW.queue_date := CURRENT_DATE + days_to_add;
  
  -- Preserve original creation time for exact time scheduling
  IF NEW.original_created_at IS NULL THEN
    NEW.original_created_at := NEW.created_at;
  END IF;
  
  -- Calculate exact processing datetime (same time as original, but on queue_date)
  base_time := NEW.original_created_at;
  NEW.calculated_process_datetime := NEW.queue_date::timestamp 
    + base_time::time;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. Create trigger for queue date calculation
DROP TRIGGER IF EXISTS set_google_queue_position ON google_indexing_queue;
CREATE TRIGGER set_google_queue_position
  BEFORE INSERT OR UPDATE OF status ON google_indexing_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION calculate_google_queue_position();

-- 5. Create function to recalculate all pending queue dates
CREATE OR REPLACE FUNCTION recalculate_all_queue_dates()
RETURNS TABLE (updated_count INTEGER) AS $$
DECLARE
  item RECORD;
  counter INTEGER := 0;
  daily_limit INTEGER := 180;
  days_to_add INTEGER;
  base_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Loop through all pending items in FIFO order
  FOR item IN 
    SELECT id, queue_position, original_created_at, created_at
    FROM google_indexing_queue
    WHERE status = 'pending'
      AND retry_count < 5
    ORDER BY queue_position ASC, created_at ASC
  LOOP
    counter := counter + 1;
    days_to_add := FLOOR((counter - 1) / daily_limit);
    
    base_time := COALESCE(item.original_created_at, item.created_at);
    
    UPDATE google_indexing_queue
    SET 
      queue_date = CURRENT_DATE + days_to_add,
      calculated_process_datetime = (CURRENT_DATE + days_to_add)::timestamp + base_time::time,
      original_created_at = COALESCE(original_created_at, created_at)
    WHERE id = item.id;
  END LOOP;
  
  updated_count := counter;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 6. Create function for sequential single-job processing
CREATE OR REPLACE FUNCTION get_next_pending_job_for_indexing()
RETURNS TABLE (
  id uuid,
  url text,
  job_id uuid,
  action text,
  queue_position bigint,
  original_created_at timestamptz,
  calculated_process_datetime timestamptz,
  retry_count integer
) AS $$
BEGIN
  -- Get single next job to process (strict FIFO)
  RETURN QUERY
  SELECT 
    gq.id,
    gq.url,
    gq.job_id,
    gq.action,
    gq.queue_position,
    gq.original_created_at,
    gq.calculated_process_datetime,
    gq.retry_count
  FROM google_indexing_queue gq
  WHERE gq.status = 'pending'
    AND gq.retry_count < 5
    AND (gq.scheduled_for IS NULL OR gq.scheduled_for <= NOW())
  ORDER BY gq.queue_position ASC, gq.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 7. Create function to schedule next verification check
CREATE OR REPLACE FUNCTION schedule_verification_check(p_job_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE job_indexing_status
  SET 
    next_verification_at = NOW() + INTERVAL '24 hours',
    verification_attempt_count = COALESCE(verification_attempt_count, 0) + 1,
    updated_at = NOW()
  WHERE job_id = p_job_id
    AND is_google_public = false
    AND COALESCE(verification_attempt_count, 0) < COALESCE(max_verification_attempts, 5);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 8. Create function to get jobs due for verification
CREATE OR REPLACE FUNCTION get_jobs_due_for_verification(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  url text,
  google_status text,
  google_submitted_at timestamptz,
  verification_attempt_count integer,
  max_verification_attempts integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jis.id,
    jis.job_id,
    jis.url,
    jis.google_status,
    jis.google_submitted_at,
    COALESCE(jis.verification_attempt_count, 0),
    COALESCE(jis.max_verification_attempts, 5)
  FROM job_indexing_status jis
  WHERE jis.is_google_public = false
    AND jis.google_status IN ('submitted', 'scheduled', 'queued')
    AND (
      jis.next_verification_at IS NULL 
      OR jis.next_verification_at <= NOW()
    )
    AND COALESCE(jis.verification_attempt_count, 0) < COALESCE(jis.max_verification_attempts, 5)
  ORDER BY jis.google_submitted_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 9. Create view for quota dashboard
CREATE OR REPLACE VIEW indexing_quota_status AS
SELECT 
  (SELECT COUNT(*) FROM google_indexing_queue WHERE status = 'pending' AND retry_count < 5) AS total_pending,
  (SELECT quota_used FROM indexing_daily_quota WHERE date = CURRENT_DATE LIMIT 1) AS today_used,
  (SELECT quota_limit FROM indexing_daily_quota WHERE date = CURRENT_DATE LIMIT 1) AS today_limit,
  180 AS effective_daily_limit,
  CEIL((SELECT COUNT(*) FROM google_indexing_queue WHERE status = 'pending' AND retry_count < 5)::numeric / 180) AS estimated_days_to_clear,
  (SELECT MIN(queue_date) FROM google_indexing_queue WHERE status = 'pending') AS next_processing_date,
  (SELECT MAX(queue_date) FROM google_indexing_queue WHERE status = 'pending') AS last_queue_date;

-- 10. Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_google_queue_pending_fifo 
  ON google_indexing_queue (queue_position ASC, created_at ASC) 
  WHERE status = 'pending' AND retry_count < 5;

CREATE INDEX IF NOT EXISTS idx_job_indexing_verification_due 
  ON job_indexing_status (next_verification_at ASC) 
  WHERE is_google_public = false AND google_status IN ('submitted', 'scheduled', 'queued');

-- 11. Run initial queue date calculation
SELECT recalculate_all_queue_dates();