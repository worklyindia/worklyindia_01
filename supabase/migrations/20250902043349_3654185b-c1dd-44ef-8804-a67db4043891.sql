-- Phase 1: Extend jobs table with trending system columns (simpler approach)
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS trending_score DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_count INTEGER DEFAULT 0;

-- Create job_interactions table for tracking all user interactions
CREATE TABLE IF NOT EXISTS public.job_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  user_id UUID,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'apply', 'call', 'share', 'comment')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job_comments table for future comment functionality
CREATE TABLE IF NOT EXISTS public.job_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.job_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_interactions
CREATE POLICY "Anyone can create interactions" ON public.job_interactions
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own interactions" ON public.job_interactions
FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS policies for job_comments  
CREATE POLICY "Users can create their own comments" ON public.job_comments
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view comments on jobs" ON public.job_comments
FOR SELECT USING (true);

CREATE POLICY "Users can update their own comments" ON public.job_comments
FOR UPDATE USING (auth.uid() = user_id);

-- Create function to calculate trending score
CREATE OR REPLACE FUNCTION public.calculate_trending_score(job_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    job_record RECORD;
    hours_since_posted DECIMAL;
    decay_factor DECIMAL;
    base_score DECIMAL;
    final_score DECIMAL;
BEGIN
    -- Get job data
    SELECT * INTO job_record FROM jobs WHERE id = job_id;
    
    IF job_record.id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate hours since posted
    hours_since_posted := EXTRACT(EPOCH FROM (NOW() - job_record.created_at)) / 3600;
    
    -- Calculate decay factor (10 points per day)
    decay_factor := (hours_since_posted / 24) * 10;
    
    -- Calculate base score using the formula:
    -- score = (views * 1) + (applies * 5) + (calls * 5) + (shares * 3) + (comments * 2)
    base_score := 
        (COALESCE(job_record.views_count, 0) * 1) +
        (COALESCE(job_record.applications_count, 0) * 5) +
        (COALESCE(job_record.calls_count, 0) * 5) +
        (COALESCE(job_record.shares_count, 0) * 3) +
        (COALESCE(job_record.comments_count, 0) * 2);
    
    -- Apply decay
    final_score := base_score - decay_factor;
    
    -- New job boost (less than 24 hours = minimum 50 points)
    IF hours_since_posted < 24 THEN
        final_score := GREATEST(final_score, 50);
    END IF;
    
    -- Ensure score is not negative
    final_score := GREATEST(final_score, 0);
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;