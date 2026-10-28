-- Add trending_rank column to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS trending_rank integer;

-- Create function to update trending ranks based on trending_score
CREATE OR REPLACE FUNCTION public.update_trending_ranks()
RETURNS void AS $$
BEGIN
  -- Update trending ranks based on trending_score (includes boost)
  WITH ranked_jobs AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY trending_score DESC, created_at DESC) as rank
    FROM public.jobs
    WHERE status = 'active'
  )
  UPDATE public.jobs
  SET trending_rank = CASE 
    WHEN ranked_jobs.rank <= 3 THEN ranked_jobs.rank::integer
    ELSE NULL
  END
  FROM ranked_jobs
  WHERE jobs.id = ranked_jobs.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update trending ranks when trending_score changes
CREATE OR REPLACE FUNCTION public.trigger_update_trending_ranks()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate all trending ranks when any job's trending_score changes
  PERFORM update_trending_ranks();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_trending_score_change ON public.jobs;

-- Create trigger on jobs table
CREATE TRIGGER on_trending_score_change
  AFTER INSERT OR UPDATE OF trending_score ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_trending_ranks();

-- Initial update of all trending ranks
SELECT update_trending_ranks();