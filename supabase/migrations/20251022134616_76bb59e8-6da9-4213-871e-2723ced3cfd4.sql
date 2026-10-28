-- Fix trending score calculation - Remove recency bonus from all score calculations
-- Formula: trending_score = base_score + boost_value (NO recency)

-- Update the main trigger function
CREATE OR REPLACE FUNCTION public.calculate_job_trending_score()
RETURNS TRIGGER AS $$
DECLARE
  base_score NUMERIC;
  boost_value NUMERIC;
BEGIN
  -- Base Score = (views × 0.10) + (applications × 1.0)
  base_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Boost value: boost_level × 100
  -- Only apply if boosted and not expired
  IF NEW.is_boosted = true AND (NEW.boost_end_date IS NULL OR NEW.boost_end_date > NOW()) THEN
    boost_value := COALESCE(NEW.boost_level, 0) * 100;
  ELSE
    boost_value := 0;
  END IF;
  
  -- Final trending score = base_score + boost_value (NO recency)
  NEW.trending_score := ROUND(base_score + boost_value, 2);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

-- Update the v2 calculation function
CREATE OR REPLACE FUNCTION public.calculate_trending_score_v2(p_job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_views integer;
  v_applies integer;
  v_base numeric;
  v_boost numeric;
  v_is_boosted boolean;
  v_boost_level int;
  v_boost_end timestamptz;
BEGIN
  SELECT 
    COALESCE(views_count, 0),
    COALESCE(applications_count, 0),
    COALESCE(is_boosted, false),
    COALESCE(boost_level, 0),
    boost_end_date
  INTO v_views, v_applies, v_is_boosted, v_boost_level, v_boost_end
  FROM jobs WHERE id = p_job_id;

  -- Base score: (views × 0.10) + (applications × 1.0)
  v_base := (v_views * 0.10) + (v_applies * 1.0);
  
  -- Boost points: boost_level × 100 (only if boosted and not expired)
  v_boost := CASE 
    WHEN v_is_boosted AND (v_boost_end IS NULL OR v_boost_end > NOW())
    THEN v_boost_level * 100.0 
    ELSE 0 
  END;

  -- Final score = base + boost (NO recency)
  RETURN ROUND(v_base + v_boost, 2);
END;
$$;

-- Recalculate all job scores using the corrected formula
SELECT update_all_trending_scores();

-- Update all ranks
SELECT update_trending_ranks();
SELECT update_organic_ranks();