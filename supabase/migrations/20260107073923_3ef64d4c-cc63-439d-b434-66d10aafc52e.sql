-- Fix delete_expired_jobs_immediately to queue URL_DELETED before deleting
CREATE OR REPLACE FUNCTION public.delete_expired_jobs_immediately()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
  expired_job RECORD;
  job_url TEXT;
  job_slug TEXT;
BEGIN
  -- First, add URL_DELETED for each expired job BEFORE deleting them
  FOR expired_job IN 
    SELECT id, title, public_slug, slug
    FROM public.jobs
    WHERE expires_at < NOW()
      AND status IN ('active', 'expired')
  LOOP
    -- Generate URL using same logic as add_job_to_indexing_queue
    IF expired_job.public_slug IS NOT NULL AND expired_job.public_slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || expired_job.public_slug;
    ELSIF expired_job.slug IS NOT NULL AND expired_job.slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || expired_job.slug;
    ELSE
      job_slug := regexp_replace(lower(expired_job.title), '[^a-z0-9]+', '-', 'g');
      job_slug := trim(both '-' from job_slug);
      job_url := 'https://worklyindia.devs.surf/job/' || job_slug || '-' || expired_job.id;
    END IF;
    
    -- Add deletion request to queue
    INSERT INTO public.google_indexing_queue (
      job_id, url, status, action, priority, source, page_type, retry_count, created_at
    ) VALUES (
      expired_job.id, job_url, 'pending', 'URL_DELETED', 10, 
      'job_expire_trigger', 'job', 0, NOW()
    )
    ON CONFLICT (url) DO UPDATE SET
      status = 'pending',
      action = 'URL_DELETED',
      priority = 10,
      retry_count = 0,
      created_at = NOW();
  END LOOP;
  
  -- Then delete the expired jobs
  WITH deleted AS (
    DELETE FROM public.jobs
    WHERE expires_at < NOW()
      AND status IN ('active', 'expired')
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN COALESCE(deleted_count, 0);
END;
$$;

-- Fix check_and_delete_expired_jobs trigger to queue URL_DELETED before delete
CREATE OR REPLACE FUNCTION public.check_and_delete_expired_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_url TEXT;
  job_slug TEXT;
BEGIN
  -- If job is being updated and is now expired, add to deletion queue then delete
  IF NEW.expires_at < NOW() THEN
    -- Generate URL
    IF NEW.public_slug IS NOT NULL AND NEW.public_slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || NEW.public_slug;
    ELSIF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || NEW.slug;
    ELSE
      job_slug := regexp_replace(lower(NEW.title), '[^a-z0-9]+', '-', 'g');
      job_slug := trim(both '-' from job_slug);
      job_url := 'https://worklyindia.devs.surf/job/' || job_slug || '-' || NEW.id;
    END IF;
    
    -- Add deletion request to queue
    INSERT INTO public.google_indexing_queue (
      job_id, url, status, action, priority, source, page_type, retry_count, created_at
    ) VALUES (
      NEW.id, job_url, 'pending', 'URL_DELETED', 10, 
      'job_expire_update_trigger', 'job', 0, NOW()
    )
    ON CONFLICT (url) DO UPDATE SET
      status = 'pending',
      action = 'URL_DELETED',
      priority = 10,
      retry_count = 0,
      created_at = NOW();
    
    DELETE FROM public.jobs WHERE id = NEW.id;
    RETURN NULL; -- Prevent the update since we deleted it
  END IF;
  RETURN NEW;
END;
$$;

-- Create BEFORE DELETE trigger to catch any direct hard deletes
CREATE OR REPLACE FUNCTION public.handle_job_hard_delete()
RETURNS TRIGGER AS $$
DECLARE
  job_url TEXT;
  job_slug TEXT;
BEGIN
  -- Generate URL for the job being deleted
  IF OLD.public_slug IS NOT NULL AND OLD.public_slug != '' THEN
    job_url := 'https://worklyindia.devs.surf/job/' || OLD.public_slug;
  ELSIF OLD.slug IS NOT NULL AND OLD.slug != '' THEN
    job_url := 'https://worklyindia.devs.surf/job/' || OLD.slug;
  ELSE
    job_slug := regexp_replace(lower(OLD.title), '[^a-z0-9]+', '-', 'g');
    job_slug := trim(both '-' from job_slug);
    job_url := 'https://worklyindia.devs.surf/job/' || job_slug || '-' || OLD.id;
  END IF;
  
  -- Add URL_DELETED request to queue (catches any direct DELETE operations)
  INSERT INTO public.google_indexing_queue (
    job_id, url, status, action, priority, source, page_type, retry_count, created_at
  ) VALUES (
    OLD.id, job_url, 'pending', 'URL_DELETED', 10, 
    'job_hard_delete_trigger', 'job', 0, NOW()
  )
  ON CONFLICT (url) DO UPDATE SET
    status = 'pending',
    action = 'URL_DELETED',
    priority = 10,
    retry_count = 0,
    created_at = NOW();
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop if exists and create the BEFORE DELETE trigger
DROP TRIGGER IF EXISTS trigger_job_hard_delete ON public.jobs;

CREATE TRIGGER trigger_job_hard_delete
  BEFORE DELETE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_job_hard_delete();

-- Add comments
COMMENT ON FUNCTION public.delete_expired_jobs_immediately() IS 'Immediately deletes all expired jobs after queuing URL_DELETED for Google/Bing removal';
COMMENT ON FUNCTION public.check_and_delete_expired_jobs() IS 'Trigger function that queues URL_DELETED then deletes expired jobs on update';
COMMENT ON FUNCTION public.handle_job_hard_delete() IS 'BEFORE DELETE trigger to queue URL_DELETED for any direct job deletions';