-- Phase 1: Add trending system columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS trending_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS total_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_views_count INTEGER DEFAULT 0;

-- Create company_interactions table for tracking company profile interactions
CREATE TABLE IF NOT EXISTS public.company_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NULL, -- NULL for anonymous users
  interaction_type TEXT NOT NULL, -- 'view', 'job_click', 'favorite', 'contact'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on company_interactions
ALTER TABLE public.company_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_interactions
CREATE POLICY "Anyone can create interactions" 
ON public.company_interactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their own interactions" 
ON public.company_interactions 
FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

-- Phase 2: Create company trending score calculation function
CREATE OR REPLACE FUNCTION public.calculate_company_trending_score(company_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    company_record RECORD;
    hours_since_created DECIMAL;
    decay_factor DECIMAL;
    base_score DECIMAL;
    verification_bonus DECIMAL := 0;
    active_jobs_bonus DECIMAL := 0;
    rating_bonus DECIMAL := 0;
    completeness_bonus DECIMAL := 0;
    views_bonus DECIMAL := 0;
    size_bonus DECIMAL := 0;
    new_company_bonus DECIMAL := 0;
    final_score DECIMAL;
    active_jobs_count INTEGER;
    company_rating DECIMAL;
    profile_completeness DECIMAL;
BEGIN
    -- Get company data
    SELECT * INTO company_record FROM companies WHERE id = company_id;
    
    IF company_record.id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate hours since company creation
    hours_since_created := EXTRACT(EPOCH FROM (NOW() - company_record.created_at)) / 3600;
    
    -- Get active jobs count
    SELECT COUNT(*) INTO active_jobs_count
    FROM jobs j
    WHERE j.company_id = company_id AND j.status = 'active';
    
    -- Get company rating from reviews
    SELECT COALESCE(AVG(rating), 0) INTO company_rating
    FROM company_reviews cr
    WHERE cr.company_id = company_id;
    
    -- Calculate profile completeness (0-1 scale)
    profile_completeness := (
        CASE WHEN company_record.company_name IS NOT NULL AND company_record.company_name != '' THEN 0.2 ELSE 0 END +
        CASE WHEN company_record.description IS NOT NULL AND company_record.description != '' THEN 0.2 ELSE 0 END +
        CASE WHEN company_record.website IS NOT NULL AND company_record.website != '' THEN 0.1 ELSE 0 END +
        CASE WHEN company_record.logo_url IS NOT NULL AND company_record.logo_url != '' THEN 0.1 ELSE 0 END +
        CASE WHEN company_record.industry IS NOT NULL AND company_record.industry != '' THEN 0.1 ELSE 0 END +
        CASE WHEN company_record.company_size IS NOT NULL AND company_record.company_size != '' THEN 0.1 ELSE 0 END +
        CASE WHEN company_record.location IS NOT NULL AND company_record.location != '' THEN 0.1 ELSE 0 END +
        CASE WHEN company_record.phone IS NOT NULL AND company_record.phone != '' THEN 0.1 ELSE 0 END
    );
    
    -- Calculate bonuses
    -- Verification Status (100 points for verified)
    IF company_record.is_verified = true AND company_record.verified_plan_end > NOW() THEN
        verification_bonus := 100;
    END IF;
    
    -- Active Jobs Count (10 points per active job)
    active_jobs_bonus := active_jobs_count * 10;
    
    -- Company Rating (20 points per star)
    rating_bonus := company_rating * 20;
    
    -- Profile Completeness (15 points for complete profile)
    completeness_bonus := profile_completeness * 15;
    
    -- Profile Views (2 points per 10 views)
    views_bonus := COALESCE(company_record.profile_views_count, 0) * 0.2;
    
    -- Company Size Bonus
    size_bonus := CASE 
        WHEN LOWER(COALESCE(company_record.company_size, '')) LIKE '%1000%' OR 
             LOWER(COALESCE(company_record.company_size, '')) LIKE '%enterprise%' OR
             LOWER(COALESCE(company_record.company_size, '')) LIKE '%large%' THEN 10
        WHEN LOWER(COALESCE(company_record.company_size, '')) LIKE '%100%' OR 
             LOWER(COALESCE(company_record.company_size, '')) LIKE '%medium%' THEN 5
        ELSE 0
    END;
    
    -- New Company Boost (first 30 days)
    IF hours_since_created < 720 THEN -- 30 days
        new_company_bonus := 30 * (1 - (hours_since_created / 720));
    END IF;
    
    -- Recent Job Posts Bonus (posted job in last 7 days)
    IF EXISTS (
        SELECT 1 FROM jobs j 
        WHERE j.company_id = company_id 
        AND j.created_at > NOW() - INTERVAL '7 days'
        AND j.status = 'active'
    ) THEN
        verification_bonus := verification_bonus + 25;
    END IF;
    
    -- Calculate decay factor (1 point per week)
    decay_factor := (hours_since_created / 168) * 1; -- 168 hours = 1 week
    
    -- Calculate final score
    base_score := verification_bonus + active_jobs_bonus + rating_bonus + 
                  completeness_bonus + views_bonus + size_bonus + new_company_bonus;
    
    final_score := base_score - decay_factor;
    
    -- Ensure score is not negative
    final_score := GREATEST(final_score, 0);
    
    RETURN final_score;
END;
$function$;

-- Function to update company trending score
CREATE OR REPLACE FUNCTION public.update_company_trending_score(company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_score NUMERIC;
BEGIN
  -- Calculate and update the trending score for this specific company
  SELECT calculate_company_trending_score(company_id) INTO new_score;
  
  UPDATE companies 
  SET trending_score = new_score, updated_at = now() 
  WHERE id = company_id;
END;
$function$;

-- Function to update all company trending scores
CREATE OR REPLACE FUNCTION public.update_all_company_trending_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER := 0;
  company_record RECORD;
BEGIN
  -- Update trending scores for all companies with complete profiles
  FOR company_record IN 
    SELECT id FROM companies WHERE is_profile_complete = true
  LOOP
    PERFORM update_company_trending_score(company_record.id);
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$function$;