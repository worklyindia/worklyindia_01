-- Fix organic rank calculation to properly assign ranks 1, 2, 3 based on base_score
CREATE OR REPLACE FUNCTION public.update_organic_ranks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate base_score and assign organic_rank (1, 2, 3) for top 3 active jobs
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

-- Recalculate all organic ranks immediately
SELECT update_organic_ranks();