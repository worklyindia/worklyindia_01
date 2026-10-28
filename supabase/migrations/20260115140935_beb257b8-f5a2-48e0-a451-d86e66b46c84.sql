-- 1. Add content_hash column to job_indexing_status for smart re-indexing
ALTER TABLE job_indexing_status ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE job_indexing_status ADD COLUMN IF NOT EXISTS last_indexed_content_hash TEXT;
ALTER TABLE job_indexing_status ADD COLUMN IF NOT EXISTS reindex_count INTEGER DEFAULT 0;

-- 2. Add enhanced scheduling columns to google_indexing_queue
ALTER TABLE google_indexing_queue ADD COLUMN IF NOT EXISTS exact_scheduled_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE google_indexing_queue ADD COLUMN IF NOT EXISTS days_pending INTEGER DEFAULT 0;

-- 3. Create function to generate content hash from job data
CREATE OR REPLACE FUNCTION generate_job_content_hash(job_id UUID)
RETURNS TEXT AS $$
DECLARE
  job_data RECORD;
  hash_input TEXT;
BEGIN
  SELECT title, description, requirements, salary_min, salary_max, location, job_type
  INTO job_data
  FROM jobs
  WHERE id = job_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Concatenate important fields for hash
  hash_input := COALESCE(job_data.title, '') || '|' ||
                COALESCE(LEFT(job_data.description, 500), '') || '|' ||
                COALESCE(job_data.salary_min::text, '') || '|' ||
                COALESCE(job_data.salary_max::text, '') || '|' ||
                COALESCE(job_data.location, '') || '|' ||
                COALESCE(job_data.job_type, '');
  
  RETURN encode(sha256(hash_input::bytea), 'hex');
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. Create function to check if job content changed
CREATE OR REPLACE FUNCTION has_job_content_changed(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_hash TEXT;
  last_hash TEXT;
BEGIN
  -- Get current content hash
  current_hash := generate_job_content_hash(p_job_id);
  
  -- Get last indexed hash
  SELECT last_indexed_content_hash INTO last_hash
  FROM job_indexing_status
  WHERE job_id = p_job_id
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- If no previous hash, content is new/changed
  IF last_hash IS NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN current_hash != last_hash;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. Update calculate_google_queue_position to include exact time
CREATE OR REPLACE FUNCTION calculate_google_queue_position()
RETURNS TRIGGER AS $$
DECLARE
  current_pending_count INTEGER;
  daily_limit INTEGER := 180;
  days_to_add INTEGER;
  base_time TIMESTAMP WITH TIME ZONE;
  ist_offset INTERVAL := '5 hours 30 minutes';
BEGIN
  -- Get count of pending items ahead in queue
  SELECT COUNT(*) INTO current_pending_count
  FROM google_indexing_queue
  WHERE status = 'pending'
    AND retry_count < 5
    AND queue_position < COALESCE(NEW.queue_position, 999999999);
  
  -- Calculate which day this job will be processed
  days_to_add := FLOOR(current_pending_count / daily_limit);
  
  -- Set queue_date (when this job should be processed)
  NEW.queue_date := CURRENT_DATE + days_to_add;
  NEW.days_pending := days_to_add;
  
  -- Preserve original creation time for exact time scheduling
  IF NEW.original_created_at IS NULL THEN
    NEW.original_created_at := NEW.created_at;
  END IF;
  
  -- Calculate exact processing datetime (same time as original, but on queue_date)
  base_time := NEW.original_created_at;
  NEW.calculated_process_datetime := (NEW.queue_date::timestamp + base_time::time)::timestamp with time zone;
  NEW.exact_scheduled_time := NEW.calculated_process_datetime;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 6. Create view for enhanced quota dashboard
DROP VIEW IF EXISTS indexing_quota_dashboard;
CREATE VIEW indexing_quota_dashboard AS
SELECT 
  CURRENT_DATE AS date,
  (SELECT COALESCE(quota_used, 0) FROM indexing_daily_quota WHERE date = CURRENT_DATE LIMIT 1) AS today_used,
  180 AS effective_daily_limit,
  200 AS total_daily_limit,
  180 - COALESCE((SELECT quota_used FROM indexing_daily_quota WHERE date = CURRENT_DATE LIMIT 1), 0) AS remaining_today,
  (SELECT COUNT(*) FROM google_indexing_queue WHERE status = 'pending' AND retry_count < 5) AS total_pending,
  (SELECT COUNT(*) FROM google_indexing_queue WHERE status = 'pending' AND queue_date = CURRENT_DATE) AS pending_today,
  (SELECT COUNT(*) FROM google_indexing_queue WHERE status = 'pending' AND queue_date = CURRENT_DATE + 1) AS pending_tomorrow,
  CEIL((SELECT COUNT(*) FROM google_indexing_queue WHERE status = 'pending' AND retry_count < 5)::numeric / 180) AS estimated_days_to_clear,
  (SELECT MIN(queue_date) FROM google_indexing_queue WHERE status = 'pending') AS next_processing_date,
  (SELECT MAX(queue_date) FROM google_indexing_queue WHERE status = 'pending') AS last_queue_date,
  (SELECT COUNT(*) FROM google_indexing_queue WHERE status = 'completed' AND DATE(processed_at) = CURRENT_DATE) AS indexed_today,
  (SELECT COUNT(*) FROM job_indexing_status WHERE is_google_public = true) AS total_public;

-- 7. Create index for faster queue date queries
CREATE INDEX IF NOT EXISTS idx_google_queue_date ON google_indexing_queue(queue_date, status);
CREATE INDEX IF NOT EXISTS idx_google_queue_exact_time ON google_indexing_queue(exact_scheduled_time);

-- 8. Update all pending items with days_pending
UPDATE google_indexing_queue 
SET days_pending = CASE 
  WHEN queue_date IS NOT NULL THEN (queue_date - CURRENT_DATE)::INTEGER
  ELSE 0
END
WHERE status = 'pending';