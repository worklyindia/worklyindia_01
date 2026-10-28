-- Drop existing UPDATE trigger
DROP TRIGGER IF EXISTS trigger_update_job_indexing_queue ON public.jobs;

-- Create new UPDATE trigger that fires on ANY job content change (not just status/visibility)
CREATE TRIGGER trigger_update_job_indexing_queue
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  WHEN (
    -- Status or visibility changes
    OLD.status IS DISTINCT FROM NEW.status 
    OR OLD.visibility IS DISTINCT FROM NEW.visibility
    -- Content changes that require re-indexing
    OR OLD.title IS DISTINCT FROM NEW.title
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.requirements IS DISTINCT FROM NEW.requirements
    OR OLD.benefits IS DISTINCT FROM NEW.benefits
    OR OLD.salary_min IS DISTINCT FROM NEW.salary_min
    OR OLD.salary_max IS DISTINCT FROM NEW.salary_max
    OR OLD.salary_range IS DISTINCT FROM NEW.salary_range
    OR OLD.job_type IS DISTINCT FROM NEW.job_type
    OR OLD.experience_level IS DISTINCT FROM NEW.experience_level
    OR OLD.location IS DISTINCT FROM NEW.location
    OR OLD.skills IS DISTINCT FROM NEW.skills
    OR OLD.category IS DISTINCT FROM NEW.category
    OR OLD.department IS DISTINCT FROM NEW.department
  )
  EXECUTE FUNCTION public.add_job_to_indexing_queue();

-- Add comment for documentation
COMMENT ON TRIGGER trigger_update_job_indexing_queue ON public.jobs IS 'Triggers re-indexing when job content is updated (title, description, salary, etc.) in addition to status/visibility changes';