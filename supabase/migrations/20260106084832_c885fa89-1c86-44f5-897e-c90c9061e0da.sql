-- Fix the queue_job_for_indexing function to remove references to non-existent 'slug' field
-- The jobs table only has 'public_slug', not 'slug'

CREATE OR REPLACE FUNCTION public.queue_job_for_indexing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  base_url TEXT := 'https://rozgaardhundo.com';
  job_url TEXT;
  job_slug TEXT;
  action_type TEXT;
BEGIN
  -- Handle DELETE operation
  IF TG_OP = 'DELETE' THEN
    -- Use public_slug or id for URL (removed reference to non-existent slug field)
    job_slug := COALESCE(OLD.public_slug, OLD.id::TEXT);
    job_url := base_url || '/job/' || job_slug;
    
    INSERT INTO google_indexing_queue (url, action, status, source, job_id, priority, metadata)
    VALUES (
      job_url,
      'URL_DELETED',
      'pending',
      'trigger_delete',
      OLD.id,
      10,
      jsonb_build_object(
        'job_title', OLD.title,
        'company_id', OLD.company_id,
        'deleted_at', NOW()
      )
    )
    ON CONFLICT (url) DO UPDATE SET
      action = 'URL_DELETED',
      status = 'pending',
      priority = 10,
      metadata = EXCLUDED.metadata,
      created_at = NOW();
    
    RETURN OLD;
  END IF;

  -- Handle INSERT and UPDATE operations
  -- Use public_slug or id for URL (removed reference to non-existent slug field)
  job_slug := COALESCE(NEW.public_slug, NEW.id::TEXT);
  job_url := base_url || '/job/' || job_slug;
  
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_type := 'URL_UPDATED';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if job was just published or status changed
    IF OLD.status != 'active' AND NEW.status = 'active' THEN
      action_type := 'URL_UPDATED';
    ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
      action_type := 'URL_DELETED';
    ELSIF NEW.status = 'active' THEN
      -- Only queue if important fields changed
      IF OLD.title != NEW.title OR 
         OLD.description != NEW.description OR 
         OLD.salary_min != NEW.salary_min OR 
         OLD.salary_max != NEW.salary_max OR
         OLD.location != NEW.location THEN
        action_type := 'URL_UPDATED';
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Only queue active jobs for indexing
  IF NEW.status = 'active' OR action_type = 'URL_DELETED' THEN
    INSERT INTO google_indexing_queue (url, action, status, source, job_id, priority, metadata)
    VALUES (
      job_url,
      action_type,
      'pending',
      'trigger_' || lower(TG_OP),
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN 8 ELSE 5 END,
      jsonb_build_object(
        'job_title', NEW.title,
        'company_id', NEW.company_id,
        'operation', TG_OP,
        'queued_at', NOW()
      )
    )
    ON CONFLICT (url) DO UPDATE SET
      action = EXCLUDED.action,
      status = 'pending',
      priority = GREATEST(google_indexing_queue.priority, EXCLUDED.priority),
      metadata = EXCLUDED.metadata,
      created_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;