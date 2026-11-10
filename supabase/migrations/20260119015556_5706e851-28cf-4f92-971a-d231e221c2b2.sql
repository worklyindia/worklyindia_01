-- Create trigger function to protect submission timestamps from being overwritten
CREATE OR REPLACE FUNCTION protect_indexing_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Preserve google_submitted_at if already set (first submission date)
  IF OLD.google_submitted_at IS NOT NULL AND NEW.google_submitted_at IS NOT NULL THEN
    NEW.google_submitted_at := OLD.google_submitted_at;
  END IF;
  
  -- Preserve bing_submitted_at if already set (first submission date)
  IF OLD.bing_submitted_at IS NOT NULL AND NEW.bing_submitted_at IS NOT NULL THEN
    NEW.bing_submitted_at := OLD.bing_submitted_at;
  END IF;
  
  -- Preserve created_at always
  IF OLD.created_at IS NOT NULL THEN
    NEW.created_at := OLD.created_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS preserve_job_indexing_timestamps ON job_indexing_status;

CREATE TRIGGER preserve_job_indexing_timestamps
BEFORE UPDATE ON job_indexing_status
FOR EACH ROW
EXECUTE FUNCTION protect_indexing_timestamps();

-- Also protect google_indexing_queue timestamps
CREATE OR REPLACE FUNCTION protect_queue_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Preserve first_attempt_at if already set
  IF OLD.first_attempt_at IS NOT NULL THEN
    NEW.first_attempt_at := OLD.first_attempt_at;
  END IF;
  
  -- Preserve google_submitted_at if already set
  IF OLD.google_submitted_at IS NOT NULL AND NEW.google_submitted_at IS NOT NULL THEN
    NEW.google_submitted_at := OLD.google_submitted_at;
  END IF;
  
  -- Preserve created_at always
  IF OLD.created_at IS NOT NULL THEN
    NEW.created_at := OLD.created_at;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS preserve_queue_timestamps ON google_indexing_queue;

CREATE TRIGGER preserve_queue_timestamps
BEFORE UPDATE ON google_indexing_queue
FOR EACH ROW
EXECUTE FUNCTION protect_queue_timestamps();

-- Add comment for documentation
COMMENT ON FUNCTION protect_indexing_timestamps() IS 'Prevents overwriting of original submission timestamps (google_submitted_at, bing_submitted_at) to preserve the original index date';
COMMENT ON FUNCTION protect_queue_timestamps() IS 'Prevents overwriting of original queue timestamps (first_attempt_at, google_submitted_at, created_at)';