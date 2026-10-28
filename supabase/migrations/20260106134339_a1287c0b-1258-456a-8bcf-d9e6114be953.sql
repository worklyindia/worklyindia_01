
-- Now update all URLs to use full job ID format
UPDATE public.google_indexing_queue 
SET url = 'https://worklyindia.devs.surf/job/' || job_id
WHERE job_id IS NOT NULL 
AND url != 'https://worklyindia.devs.surf/job/' || job_id;

-- Reset failed items to pending for retry with correct URL
UPDATE public.google_indexing_queue
SET status = 'pending',
    retry_count = 0,
    error_message = 'URL corrected to full job ID - ready for retry',
    scheduled_for = NOW() + INTERVAL '5 minutes',
    indexnow_submitted = false
WHERE status = 'failed'
AND job_id IS NOT NULL;
