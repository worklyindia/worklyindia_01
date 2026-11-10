-- Create database function to auto-queue jobs for indexing
CREATE OR REPLACE FUNCTION public.trigger_job_indexing()
RETURNS TRIGGER AS $$
DECLARE
  job_url TEXT;
  indexing_action TEXT;
  should_queue BOOLEAN := FALSE;
BEGIN
  -- Determine the job URL
  IF TG_OP = 'DELETE' THEN
    job_url := 'https://worklyindia.devs.surf/job/' || COALESCE(OLD.public_slug, OLD.id::text);
    indexing_action := 'URL_DELETED';
    should_queue := TRUE;
  ELSIF TG_OP = 'INSERT' THEN
    -- Only index if job is active
    IF NEW.status = 'active' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || COALESCE(NEW.public_slug, NEW.id::text);
      indexing_action := 'URL_UPDATED';
      should_queue := TRUE;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    job_url := 'https://worklyindia.devs.surf/job/' || COALESCE(NEW.public_slug, NEW.id::text);
    
    -- Status change from active to non-active = DELETE
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      indexing_action := 'URL_DELETED';
      should_queue := TRUE;
    -- Status change to active = UPDATE (new active job)
    ELSIF NEW.status = 'active' AND (OLD.status != 'active' OR OLD.status IS NULL) THEN
      indexing_action := 'URL_UPDATED';
      should_queue := TRUE;
    -- Active job updated = UPDATE
    ELSIF NEW.status = 'active' THEN
      indexing_action := 'URL_UPDATED';
      should_queue := TRUE;
    END IF;
  END IF;
  
  -- Queue the indexing request
  IF should_queue THEN
    INSERT INTO public.google_indexing_queue (
      url,
      action,
      status,
      source,
      job_id,
      retry_count,
      metadata,
      created_at
    ) VALUES (
      job_url,
      indexing_action,
      'pending',
      'trigger',
      COALESCE(NEW.id, OLD.id),
      0,
      jsonb_build_object(
        'event_type', TG_OP,
        'job_title', COALESCE(NEW.title, OLD.title),
        'triggered_at', now()::text
      ),
      now()
    )
    ON CONFLICT (url) DO UPDATE SET
      action = EXCLUDED.action,
      status = 'pending',
      retry_count = 0,
      metadata = EXCLUDED.metadata,
      created_at = now();
  END IF;
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS job_indexing_trigger ON public.jobs;

-- Create trigger on jobs table
CREATE TRIGGER job_indexing_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_job_indexing();

-- Add index on google_indexing_queue for better performance
CREATE INDEX IF NOT EXISTS idx_google_indexing_queue_status 
ON public.google_indexing_queue(status, retry_count, created_at);

CREATE INDEX IF NOT EXISTS idx_google_indexing_queue_job_id 
ON public.google_indexing_queue(job_id);

-- Create table for tracking cron job executions
CREATE TABLE IF NOT EXISTS public.indexing_cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_type TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT now(),
  urls_processed INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on indexing_cron_logs
ALTER TABLE public.indexing_cron_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage cron logs
CREATE POLICY "Service role can manage cron logs" ON public.indexing_cron_logs
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow admins to view cron logs
CREATE POLICY "Admins can view cron logs" ON public.indexing_cron_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid()
  )
);

-- Create function to clean up old queue entries (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_indexing_queue()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.google_indexing_queue
  WHERE status IN ('completed', 'failed')
    AND processed_at < now() - interval '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to get indexing statistics
CREATE OR REPLACE FUNCTION public.get_indexing_stats()
RETURNS TABLE (
  total_queued BIGINT,
  pending_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT,
  today_indexed BIGINT,
  this_week_indexed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_queued,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count,
    COUNT(*) FILTER (WHERE status = 'completed' AND processed_at >= CURRENT_DATE)::BIGINT as today_indexed,
    COUNT(*) FILTER (WHERE status = 'completed' AND processed_at >= CURRENT_DATE - interval '7 days')::BIGINT as this_week_indexed
  FROM public.google_indexing_queue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;