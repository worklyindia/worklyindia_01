-- First, sync existing data from google_indexing_queue to job_indexing_status
-- Use DISTINCT ON to handle duplicates
INSERT INTO public.job_indexing_status (job_id, url, google_status, google_queued_at, google_scheduled_at, google_submitted_at, bing_status, bing_submitted_at, created_at, updated_at)
SELECT DISTINCT ON (giq.job_id)
  giq.job_id,
  giq.url,
  CASE 
    WHEN giq.status = 'completed' THEN 'submitted'
    WHEN giq.status = 'pending' AND giq.processed_at IS NOT NULL THEN 'submitted'
    WHEN giq.status = 'pending' AND giq.scheduled_for IS NOT NULL THEN 'scheduled'
    WHEN giq.status = 'pending' THEN 'queued'
    WHEN giq.status = 'failed' THEN 'failed'
    ELSE 'queued'
  END as google_status,
  giq.created_at as google_queued_at,
  giq.scheduled_for as google_scheduled_at,
  giq.processed_at as google_submitted_at,
  CASE WHEN giq.indexnow_submitted = true THEN 'submitted' ELSE NULL END as bing_status,
  CASE WHEN giq.indexnow_submitted = true THEN giq.processed_at ELSE NULL END as bing_submitted_at,
  giq.created_at,
  NOW()
FROM public.google_indexing_queue giq
WHERE giq.job_id IS NOT NULL
ORDER BY giq.job_id, 
  CASE WHEN giq.status = 'completed' THEN 1 
       WHEN giq.processed_at IS NOT NULL THEN 2 
       ELSE 3 
  END,
  giq.processed_at DESC NULLS LAST
ON CONFLICT (job_id) DO UPDATE SET
  google_status = EXCLUDED.google_status,
  google_queued_at = COALESCE(job_indexing_status.google_queued_at, EXCLUDED.google_queued_at),
  google_scheduled_at = COALESCE(EXCLUDED.google_scheduled_at, job_indexing_status.google_scheduled_at),
  google_submitted_at = COALESCE(EXCLUDED.google_submitted_at, job_indexing_status.google_submitted_at),
  bing_status = COALESCE(EXCLUDED.bing_status, job_indexing_status.bing_status),
  bing_submitted_at = COALESCE(EXCLUDED.bing_submitted_at, job_indexing_status.bing_submitted_at),
  updated_at = NOW();

-- Create trigger function to auto-sync google_indexing_queue changes to job_indexing_status
CREATE OR REPLACE FUNCTION public.sync_indexing_queue_to_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if job_id exists
  IF NEW.job_id IS NOT NULL THEN
    INSERT INTO public.job_indexing_status (
      job_id, 
      url, 
      google_status,
      google_queued_at,
      google_scheduled_at,
      google_submitted_at,
      bing_status,
      bing_submitted_at,
      created_at,
      updated_at
    )
    VALUES (
      NEW.job_id,
      NEW.url,
      CASE 
        WHEN NEW.status = 'completed' THEN 'submitted'
        WHEN NEW.status = 'pending' AND NEW.processed_at IS NOT NULL THEN 'submitted'
        WHEN NEW.status = 'pending' AND NEW.scheduled_for IS NOT NULL THEN 'scheduled'
        WHEN NEW.status = 'pending' THEN 'queued'
        WHEN NEW.status = 'failed' THEN 'failed'
        ELSE 'queued'
      END,
      NEW.created_at,
      NEW.scheduled_for,
      NEW.processed_at,
      CASE WHEN NEW.indexnow_submitted = true THEN 'submitted' ELSE NULL END,
      CASE WHEN NEW.indexnow_submitted = true THEN NEW.processed_at ELSE NULL END,
      COALESCE(NEW.created_at, NOW()),
      NOW()
    )
    ON CONFLICT (job_id) DO UPDATE SET
      google_status = CASE 
        WHEN NEW.status = 'completed' THEN 'submitted'
        WHEN NEW.status = 'pending' AND NEW.processed_at IS NOT NULL THEN 'submitted'
        WHEN NEW.status = 'pending' AND NEW.scheduled_for IS NOT NULL THEN 'scheduled'
        WHEN NEW.status = 'pending' THEN 'queued'
        WHEN NEW.status = 'failed' THEN 'failed'
        ELSE job_indexing_status.google_status
      END,
      google_queued_at = COALESCE(job_indexing_status.google_queued_at, NEW.created_at),
      google_scheduled_at = COALESCE(NEW.scheduled_for, job_indexing_status.google_scheduled_at),
      google_submitted_at = COALESCE(NEW.processed_at, job_indexing_status.google_submitted_at),
      google_error = COALESCE(NEW.error_message, job_indexing_status.google_error),
      bing_status = CASE 
        WHEN NEW.indexnow_submitted = true THEN 'submitted'
        ELSE job_indexing_status.bing_status
      END,
      bing_submitted_at = CASE 
        WHEN NEW.indexnow_submitted = true THEN COALESCE(NEW.processed_at, NOW())
        ELSE job_indexing_status.bing_submitted_at
      END,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on google_indexing_queue
DROP TRIGGER IF EXISTS sync_queue_to_status_trigger ON public.google_indexing_queue;
CREATE TRIGGER sync_queue_to_status_trigger
AFTER INSERT OR UPDATE ON public.google_indexing_queue
FOR EACH ROW
EXECUTE FUNCTION public.sync_indexing_queue_to_status();

-- Enable realtime for job_indexing_status table
ALTER TABLE public.job_indexing_status REPLICA IDENTITY FULL;

-- Add to realtime publication if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'job_indexing_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_indexing_status;
  END IF;
END $$;