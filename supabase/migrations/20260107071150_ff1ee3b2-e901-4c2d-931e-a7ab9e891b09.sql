-- Create function to auto-add jobs to indexing queue on job creation/update
CREATE OR REPLACE FUNCTION public.add_job_to_indexing_queue()
RETURNS TRIGGER AS $$
DECLARE
  job_url TEXT;
  job_slug TEXT;
BEGIN
  -- Only process active, public jobs
  IF NEW.status = 'active' AND NEW.visibility = 'public' THEN
    -- Generate slug from title
    job_slug := regexp_replace(lower(NEW.title), '[^a-z0-9]+', '-', 'g');
    job_slug := trim(both '-' from job_slug);
    
    -- Use public_slug if available, otherwise generate from title
    IF NEW.public_slug IS NOT NULL AND NEW.public_slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || NEW.public_slug;
    ELSIF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
      job_url := 'https://worklyindia.devs.surf/job/' || NEW.slug;
    ELSE
      job_url := 'https://worklyindia.devs.surf/job/' || job_slug || '-' || NEW.id;
    END IF;
    
    -- Insert or update in indexing queue
    INSERT INTO public.google_indexing_queue (
      job_id,
      url,
      status,
      action,
      priority,
      source,
      page_type,
      retry_count,
      created_at
    ) VALUES (
      NEW.id,
      job_url,
      'pending',
      'URL_UPDATED',
      CASE 
        WHEN TG_OP = 'INSERT' THEN 8  -- Higher priority for new jobs
        ELSE 5  -- Normal priority for updates
      END,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'job_create_trigger'
        ELSE 'job_update_trigger'
      END,
      'job',
      0,
      NOW()
    )
    ON CONFLICT (url) 
    DO UPDATE SET
      status = 'pending',
      action = 'URL_UPDATED',
      priority = GREATEST(google_indexing_queue.priority, EXCLUDED.priority),
      retry_count = 0,
      created_at = NOW();
      
  -- If job becomes inactive or non-public, mark for deletion from index
  ELSIF (OLD.status = 'active' AND NEW.status != 'active') OR 
        (OLD.visibility = 'public' AND NEW.visibility != 'public') THEN
    -- Generate URL for deletion
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
      job_id,
      url,
      status,
      action,
      priority,
      source,
      page_type,
      retry_count,
      created_at
    ) VALUES (
      NEW.id,
      job_url,
      'pending',
      'URL_DELETED',
      10,  -- High priority for deletions
      'job_deactivate_trigger',
      'job',
      0,
      NOW()
    )
    ON CONFLICT (url) 
    DO UPDATE SET
      status = 'pending',
      action = 'URL_DELETED',
      priority = 10,
      retry_count = 0,
      created_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_add_job_to_indexing_queue ON public.jobs;

-- Create trigger for INSERT
CREATE TRIGGER trigger_add_job_to_indexing_queue
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.add_job_to_indexing_queue();

-- Create trigger for UPDATE (status/visibility changes)
DROP TRIGGER IF EXISTS trigger_update_job_indexing_queue ON public.jobs;

CREATE TRIGGER trigger_update_job_indexing_queue
  AFTER UPDATE OF status, visibility ON public.jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.visibility IS DISTINCT FROM NEW.visibility)
  EXECUTE FUNCTION public.add_job_to_indexing_queue();

-- Add comment for documentation
COMMENT ON FUNCTION public.add_job_to_indexing_queue() IS 'Automatically adds active public jobs to Google indexing queue on creation/update. Handles both indexing requests and deletion requests when jobs become inactive.';