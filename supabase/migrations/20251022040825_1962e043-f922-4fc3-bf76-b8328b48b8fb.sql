-- Fix trending score calculation to include boost consistently
-- Formula: base_score + boost_points + recency_bonus

-- 1. Update calculate_trending_score_v2 to include boost
CREATE OR REPLACE FUNCTION public.calculate_trending_score_v2(p_job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_views integer;
  v_applies integer;
  v_created_at timestamptz;
  v_days numeric;
  v_base numeric;
  v_boost numeric;
  v_recency numeric;
  v_is_boosted boolean;
  v_boost_level int;
  v_boost_end timestamptz;
BEGIN
  SELECT 
    COALESCE(views_count, 0),
    COALESCE(applications_count, 0),
    created_at,
    COALESCE(is_boosted, false),
    COALESCE(boost_level, 0),
    boost_end_date
  INTO v_views, v_applies, v_created_at, v_is_boosted, v_boost_level, v_boost_end
  FROM jobs WHERE id = p_job_id;

  -- Base score: (views × 0.10) + (applications × 1.0)
  v_base := (v_views * 0.10) + (v_applies * 1.0);
  
  -- Boost points: boost_level × 100 (only if boosted and not expired)
  v_boost := CASE 
    WHEN v_is_boosted AND (v_boost_end IS NULL OR v_boost_end > NOW())
    THEN v_boost_level * 100.0 
    ELSE 0 
  END;
  
  -- Recency bonus: 100 / (days_since_posted + 1)
  v_days := EXTRACT(DAY FROM (NOW() - v_created_at));
  v_recency := 100.0 / (v_days + 1);

  -- Final score = base + boost + recency
  RETURN ROUND(v_base + v_boost + v_recency, 2);
END;
$$;

-- 2. Update trigger function to use same formula (for immediate updates)
CREATE OR REPLACE FUNCTION public.calculate_job_trending_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_score NUMERIC;
  boost_value NUMERIC;
  days_since NUMERIC;
  recency NUMERIC;
BEGIN
  -- Base score: (views × 0.10) + (applications × 1.0)
  base_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Boost points: boost_level × 100 (only if boosted and not expired)
  IF NEW.is_boosted = true AND (NEW.boost_end_date IS NULL OR NEW.boost_end_date > NOW()) THEN
    boost_value := COALESCE(NEW.boost_level, 0) * 100;
  ELSE
    boost_value := 0;
  END IF;
  
  -- Recency bonus: 100 / (days_since_posted + 1)
  days_since := EXTRACT(DAY FROM (NOW() - NEW.created_at));
  recency := 100.0 / (days_since + 1);

  -- Final score = base + boost + recency
  NEW.trending_score := ROUND(base_score + boost_value + recency, 2);
  RETURN NEW;
END;
$$;

-- 3. Update update_job_trending_score to use v2 function
CREATE OR REPLACE FUNCTION public.update_job_trending_score(job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_score NUMERIC;
BEGIN
  SELECT calculate_trending_score_v2(job_id) INTO new_score;
  UPDATE jobs 
  SET trending_score = new_score, updated_at = now() 
  WHERE id = job_id;
END;
$$;

-- 4. Update expire_job_boosts to recalculate scores properly
CREATE OR REPLACE FUNCTION public.expire_job_boosts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_count INTEGER := 0;
  job_record RECORD;
  new_score NUMERIC;
BEGIN
  FOR job_record IN 
    SELECT id FROM jobs 
    WHERE is_boosted = true AND boost_end_date <= NOW()
  LOOP
    -- Recalculate score after removing boost
    UPDATE jobs SET
      is_boosted = false,
      boost_level = 0,
      updated_at = NOW()
    WHERE id = job_record.id;
    
    -- Get new score (without boost)
    SELECT calculate_trending_score_v2(job_record.id) INTO new_score;
    
    UPDATE jobs SET
      trending_score = new_score
    WHERE id = job_record.id;
    
    expired_count := expired_count + 1;
  END LOOP;
  RETURN expired_count;
END;
$$;

-- 5. Immediately recalculate all trending scores with new formula
UPDATE jobs 
SET trending_score = (
  SELECT calculate_trending_score_v2(jobs.id)
)
WHERE status = 'active' AND visibility = 'public';