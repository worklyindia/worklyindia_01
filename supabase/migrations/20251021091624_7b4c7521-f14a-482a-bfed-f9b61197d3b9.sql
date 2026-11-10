-- Fix search_path security issue for the functions created in previous migration

CREATE OR REPLACE FUNCTION auto_update_trending_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate base score from views and applications
  NEW.trending_score := (COALESCE(NEW.views_count, 0) * 0.10) + (COALESCE(NEW.applications_count, 0) * 1.0);
  
  -- Add boost multiplier if boosted and not expired
  IF NEW.is_boosted = true AND NEW.boost_end_date > NOW() THEN
    NEW.trending_score := NEW.trending_score + (COALESCE(NEW.boost_level, 0) * 100);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION recalculate_all_job_scores()
RETURNS void AS $$
BEGIN
  UPDATE public.jobs
  SET trending_score = (
    (COALESCE(views_count, 0) * 0.10) + 
    (COALESCE(applications_count, 0) * 1.0) +
    CASE 
      WHEN is_boosted = true AND boost_end_date > NOW() 
      THEN COALESCE(boost_level, 0) * 100 
      ELSE 0 
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';