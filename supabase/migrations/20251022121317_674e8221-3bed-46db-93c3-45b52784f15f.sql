-- Add organic_rank column to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS organic_rank INTEGER;

-- Create function to update organic ranks based on base_score
CREATE OR REPLACE FUNCTION public.update_organic_ranks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calculate base_score and assign organic_rank for all active jobs
  WITH ranked_jobs AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY 
          ((COALESCE(views_count, 0) * 0.10) + (COALESCE(applications_count, 0) * 1.0)) DESC,
          created_at DESC
      ) as rank_num
    FROM public.jobs
    WHERE status = 'active' AND visibility = 'public'
  )
  UPDATE public.jobs
  SET organic_rank = CASE 
    WHEN ranked_jobs.rank_num <= 3 THEN ranked_jobs.rank_num::integer
    ELSE NULL
  END
  FROM ranked_jobs
  WHERE jobs.id = ranked_jobs.id;
END;
$$;

-- Create trigger function for automatic organic rank updates
CREATE OR REPLACE FUNCTION public.trigger_update_organic_ranks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recalculate all organic ranks when any job's metrics change
  PERFORM update_organic_ranks();
  RETURN NEW;
END;
$$;

-- Create trigger on jobs table
DROP TRIGGER IF EXISTS jobs_update_organic_ranks ON public.jobs;
CREATE TRIGGER jobs_update_organic_ranks
AFTER INSERT OR UPDATE OF views_count, applications_count, status, visibility
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_organic_ranks();

-- Populate organic ranks for existing jobs
SELECT update_organic_ranks();