-- Create function to queue jobs for Google Indexing
CREATE OR REPLACE FUNCTION public.queue_job_for_indexing()
RETURNS TRIGGER AS $$
DECLARE
  job_url TEXT;
  action_type TEXT;
  job_slug TEXT;
BEGIN
  -- Priority: public_slug > slug > id
  IF TG_OP = 'DELETE' THEN
    job_slug := COALESCE(OLD.public_slug, OLD.slug, OLD.id::TEXT);
    job_url := 'https://worklyindia.devs.surf/job/' || job_slug;
    action_type := 'URL_DELETED';
    
    -- Queue for deletion
    INSERT INTO public.google_indexing_queue (url, action, status, source, job_id, retry_count, page_type, priority, metadata)
    VALUES (job_url, action_type, 'pending', 'auto_trigger', OLD.id, 0, 'job', 8, 
      jsonb_build_object('job_title', OLD.title, 'event_type', 'DELETE', 'triggered_at', now()))
    ON CONFLICT (url) DO UPDATE SET
      action = action_type,
      status = 'pending',
      retry_count = 0,
      metadata = jsonb_build_object('job_title', OLD.title, 'event_type', 'DELETE', 'triggered_at', now()),
      created_at = now();
    
    RETURN OLD;
  END IF;
  
  job_slug := COALESCE(NEW.public_slug, NEW.slug, NEW.id::TEXT);
  job_url := 'https://worklyindia.devs.surf/job/' || job_slug;
  
  IF TG_OP = 'INSERT' THEN
    -- Only index if job is active
    IF NEW.status = 'active' THEN
      action_type := 'URL_UPDATED';
      
      INSERT INTO public.google_indexing_queue (url, action, status, source, job_id, retry_count, page_type, priority, metadata)
      VALUES (job_url, action_type, 'pending', 'auto_trigger', NEW.id, 0, 'job', 10,
        jsonb_build_object('job_title', NEW.title, 'event_type', 'INSERT', 'triggered_at', now()))
      ON CONFLICT (url) DO UPDATE SET
        action = action_type,
        status = 'pending',
        retry_count = 0,
        priority = 10,
        metadata = jsonb_build_object('job_title', NEW.title, 'event_type', 'INSERT', 'triggered_at', now()),
        created_at = now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if status changed
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      -- Job became inactive - request deletion from index
      action_type := 'URL_DELETED';
      
      INSERT INTO public.google_indexing_queue (url, action, status, source, job_id, retry_count, page_type, priority, metadata)
      VALUES (job_url, action_type, 'pending', 'auto_trigger', NEW.id, 0, 'job', 8,
        jsonb_build_object('job_title', NEW.title, 'event_type', 'DEACTIVATE', 'triggered_at', now()))
      ON CONFLICT (url) DO UPDATE SET
        action = action_type,
        status = 'pending',
        retry_count = 0,
        metadata = jsonb_build_object('job_title', NEW.title, 'event_type', 'DEACTIVATE', 'triggered_at', now()),
        created_at = now();
    ELSIF NEW.status = 'active' THEN
      -- Job is active (new or updated) - request indexing
      action_type := 'URL_UPDATED';
      
      INSERT INTO public.google_indexing_queue (url, action, status, source, job_id, retry_count, page_type, priority, metadata)
      VALUES (job_url, action_type, 'pending', 'auto_trigger', NEW.id, 0, 'job', 8,
        jsonb_build_object('job_title', NEW.title, 'event_type', 'UPDATE', 'triggered_at', now()))
      ON CONFLICT (url) DO UPDATE SET
        action = action_type,
        status = 'pending',
        retry_count = 0,
        metadata = jsonb_build_object('job_title', NEW.title, 'event_type', 'UPDATE', 'triggered_at', now()),
        created_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on jobs table
DROP TRIGGER IF EXISTS trigger_job_indexing ON public.jobs;

CREATE TRIGGER trigger_job_indexing
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.queue_job_for_indexing();