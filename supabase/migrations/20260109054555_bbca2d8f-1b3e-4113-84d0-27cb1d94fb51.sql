-- Step 1: Identify and clean up duplicate job_id entries (keep the most recently updated one)
WITH duplicates AS (
  SELECT id, job_id,
         ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST) as rn
  FROM job_indexing_status
  WHERE job_id IS NOT NULL
)
DELETE FROM job_indexing_status
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Add unique constraint on job_id to prevent future duplicates
-- This ensures only ONE row per job, making .single() queries safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'job_indexing_status_job_id_unique'
  ) THEN
    ALTER TABLE job_indexing_status 
    ADD CONSTRAINT job_indexing_status_job_id_unique UNIQUE (job_id);
  END IF;
END $$;

-- Step 3: Add unique constraint on url to prevent duplicate URL entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'job_indexing_status_url_unique'
  ) THEN
    ALTER TABLE job_indexing_status 
    ADD CONSTRAINT job_indexing_status_url_unique UNIQUE (url);
  END IF;
END $$;