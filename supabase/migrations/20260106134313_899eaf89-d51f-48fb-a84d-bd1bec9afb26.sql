
-- Clean up duplicate job_id entries - keep only the best one per job
-- Delete older/worse entries for same job_id

-- Step 1: For each job_id that has multiple entries, keep only:
-- Priority: completed > pending > failed
-- If same status: keep the one with correct URL format, or the newest one

WITH ranked_entries AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY job_id 
           ORDER BY 
             CASE status 
               WHEN 'completed' THEN 1 
               WHEN 'pending' THEN 2 
               WHEN 'failed' THEN 3 
               ELSE 4 
             END,
             CASE WHEN url LIKE '%rozgaardhundo%' THEN 1 ELSE 0 END,
             created_at DESC
         ) as rn
  FROM public.google_indexing_queue
  WHERE job_id IS NOT NULL
)
DELETE FROM public.google_indexing_queue
WHERE id IN (
  SELECT id FROM ranked_entries WHERE rn > 1
);
