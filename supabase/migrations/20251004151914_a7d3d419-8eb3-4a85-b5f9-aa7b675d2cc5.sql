-- Phase 1: Add structured location fields to jobs table

-- Step 1: Add new location columns
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';

-- Step 2: Parse existing location data (format: "Street, City, State, Country")
-- Extract city (2nd part after comma)
UPDATE jobs 
SET city = TRIM(SPLIT_PART(location, ',', -3))
WHERE location IS NOT NULL 
  AND location LIKE '%,%,%,%'
  AND city IS NULL;

-- Extract state (3rd part after comma)
UPDATE jobs 
SET state = TRIM(SPLIT_PART(location, ',', -2))
WHERE location IS NOT NULL 
  AND location LIKE '%,%,%,%'
  AND state IS NULL;

-- Extract country (4th part after comma)
UPDATE jobs 
SET country = COALESCE(NULLIF(TRIM(SPLIT_PART(location, ',', -1)), ''), 'India')
WHERE location IS NOT NULL 
  AND location LIKE '%,%,%,%'
  AND (country IS NULL OR country = 'India');

-- For simpler formats like "City, State, Country"
UPDATE jobs 
SET 
  city = TRIM(SPLIT_PART(location, ',', -2)),
  state = TRIM(SPLIT_PART(location, ',', -1)),
  country = 'India'
WHERE location IS NOT NULL 
  AND location LIKE '%,%'
  AND location NOT LIKE '%,%,%,%'
  AND city IS NULL;

-- Ensure all jobs have country set to India
UPDATE jobs SET country = 'India' WHERE country IS NULL OR country = '';

-- Step 3: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_jobs_location_hierarchy 
  ON jobs(country, state, city) 
  WHERE status = 'active' AND visibility = 'public';

CREATE INDEX IF NOT EXISTS idx_jobs_boost_priority 
  ON jobs(is_boosted DESC, boost_level DESC, views_count DESC, applications_count DESC) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_jobs_latest_with_location 
  ON jobs(created_at DESC, country, state, city) 
  WHERE status = 'active';

-- Step 4: Add trigger to ensure country defaults to 'India'
CREATE OR REPLACE FUNCTION set_job_country_default()
RETURNS TRIGGER AS $$
BEGIN
  -- Always ensure country is set to India if not provided
  IF NEW.country IS NULL OR NEW.country = '' THEN
    NEW.country := 'India';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_job_country_default
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_job_country_default();

-- Step 5: Add helpful comments
COMMENT ON COLUMN jobs.city IS 'City where the job is located';
COMMENT ON COLUMN jobs.state IS 'State where the job is located';
COMMENT ON COLUMN jobs.country IS 'Country where the job is located (default: India)';