-- Update calculate_trending_score to include boost value
CREATE OR REPLACE FUNCTION public.calculate_trending_score(job_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_score numeric;
  boost_value numeric;
  final_score numeric;
  job_record RECORD;
BEGIN
  -- Get job details
  SELECT 
    COALESCE(views_count, 0) as views,
    COALESCE(applications_count, 0) as apps,
    COALESCE(is_boosted, false) as boosted,
    COALESCE(boost_level, 0) as boost,
    boost_end_date
  INTO job_record
  FROM public.jobs
  WHERE id = job_id;
  
  -- Calculate base score: (views × 0.10) + (applications × 1.0)
  base_score := (job_record.views * 0.10) + (job_record.apps * 1.0);
  
  -- Add boost value if job is currently boosted and boost hasn't expired
  IF job_record.boosted = true AND (job_record.boost_end_date IS NULL OR job_record.boost_end_date > now()) THEN
    boost_value := job_record.boost * 1.10;
    final_score := base_score + boost_value;
  ELSE
    final_score := base_score;
  END IF;
  
  RETURN final_score;
END;
$$;

-- Update trigger function to include boost in score calculation
CREATE OR REPLACE FUNCTION public.auto_update_trending_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_score numeric;
  boost_value numeric;
BEGIN
  -- Calculate base score: (views × 0.10) + (applications × 1.0)
  base_score := (COALESCE(NEW.views_count, 0) * 0.10) + 
                (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Add boost value if job is boosted and boost hasn't expired
  IF NEW.is_boosted = true AND (NEW.boost_end_date IS NULL OR NEW.boost_end_date > now()) THEN
    boost_value := COALESCE(NEW.boost_level, 0) * 1.10;
    NEW.trending_score := base_score + boost_value;
    NEW.boost_bonus_applied := COALESCE(NEW.boost_level, 0);
  ELSE
    NEW.trending_score := base_score;
    NEW.boost_bonus_applied := 0;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Update all existing active jobs with correct scores
UPDATE public.jobs
SET trending_score = (
  (COALESCE(views_count, 0) * 0.10) + 
  (COALESCE(applications_count, 0) * 1.0) +
  CASE 
    WHEN is_boosted = true AND (boost_end_date IS NULL OR boost_end_date > now()) 
    THEN COALESCE(boost_level, 0) * 1.10
    ELSE 0
  END
),
boost_bonus_applied = CASE 
  WHEN is_boosted = true AND (boost_end_date IS NULL OR boost_end_date > now())
  THEN COALESCE(boost_level, 0)
  ELSE 0
END
WHERE status = 'active';