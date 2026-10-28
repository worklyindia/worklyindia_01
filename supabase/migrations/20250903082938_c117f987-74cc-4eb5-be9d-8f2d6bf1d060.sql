-- Create function to sync job metrics correctly
CREATE OR REPLACE FUNCTION public.sync_job_metrics(p_job_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  job_record RECORD;
  actual_applications INTEGER;
  actual_views INTEGER;
  actual_calls INTEGER;
  actual_shares INTEGER;
BEGIN
  -- If job_id provided, sync only that job, otherwise sync all active jobs
  FOR job_record IN 
    SELECT id FROM jobs 
    WHERE (p_job_id IS NULL OR id = p_job_id) 
    AND status = 'active'
  LOOP
    -- Count actual applications from job_applications table
    SELECT COUNT(*) INTO actual_applications
    FROM job_applications 
    WHERE job_id = job_record.id;
    
    -- Count unique views from job_interactions
    SELECT get_unique_view_count(job_record.id) INTO actual_views;
    
    -- Count calls from job_interactions
    SELECT COUNT(*) INTO actual_calls
    FROM job_interactions 
    WHERE job_id = job_record.id AND interaction_type = 'call';
    
    -- Count shares from job_interactions
    SELECT COUNT(*) INTO actual_shares
    FROM job_interactions 
    WHERE job_id = job_record.id AND interaction_type = 'share';
    
    -- Update job with correct counts
    UPDATE jobs SET
      applications_count = actual_applications,
      views_count = actual_views,
      calls_count = actual_calls,
      shares_count = actual_shares,
      updated_at = now()
    WHERE id = job_record.id;
    
    -- Update trending score
    PERFORM update_job_trending_score(job_record.id);
  END LOOP;
END;
$$;

-- Create trigger to automatically sync metrics when job_applications change
CREATE OR REPLACE FUNCTION public.sync_job_application_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_job_id uuid;
  new_count integer;
BEGIN
  -- Get the job_id from the affected row
  target_job_id := COALESCE(NEW.job_id, OLD.job_id);
  
  -- Count actual applications
  SELECT COUNT(*) INTO new_count
  FROM job_applications 
  WHERE job_id = target_job_id;
  
  -- Update the job's application count
  UPDATE jobs 
  SET applications_count = new_count, updated_at = now()
  WHERE id = target_job_id;
  
  -- Update trending score
  PERFORM update_job_trending_score(target_job_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add triggers for job_applications table
DROP TRIGGER IF EXISTS sync_application_count_on_insert ON job_applications;
CREATE TRIGGER sync_application_count_on_insert
  AFTER INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION sync_job_application_count();

DROP TRIGGER IF EXISTS sync_application_count_on_delete ON job_applications;
CREATE TRIGGER sync_application_count_on_delete
  AFTER DELETE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION sync_job_application_count();

-- Fix existing inconsistent data by running sync for all jobs
SELECT sync_job_metrics();

-- Add constraint to prevent negative counts
ALTER TABLE jobs 
ADD CONSTRAINT check_non_negative_counts 
CHECK (
  applications_count >= 0 AND 
  views_count >= 0 AND 
  calls_count >= 0 AND 
  shares_count >= 0 AND
  comments_count >= 0
);