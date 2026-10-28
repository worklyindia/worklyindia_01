-- Create company reviews table
CREATE TABLE public.company_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  reviewer_name TEXT,
  reviewer_position TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company statistics table
CREATE TABLE public.company_statistics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  total_employees INTEGER DEFAULT 0,
  years_in_business INTEGER DEFAULT 0,
  client_satisfaction_rating DECIMAL(3,2) DEFAULT 0.0,
  total_projects_completed INTEGER DEFAULT 0,
  total_clients_served INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company favorites table for like functionality
CREATE TABLE public.company_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Enable RLS on company_reviews
ALTER TABLE public.company_reviews ENABLE ROW LEVEL SECURITY;

-- Create policies for company_reviews
CREATE POLICY "Anyone can view company reviews" 
ON public.company_reviews 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create reviews" 
ON public.company_reviews 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" 
ON public.company_reviews 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
ON public.company_reviews 
FOR DELETE 
USING (auth.uid() = user_id);

-- Enable RLS on company_statistics
ALTER TABLE public.company_statistics ENABLE ROW LEVEL SECURITY;

-- Create policies for company_statistics
CREATE POLICY "Anyone can view company statistics" 
ON public.company_statistics 
FOR SELECT 
USING (true);

CREATE POLICY "System can manage company statistics" 
ON public.company_statistics 
FOR ALL 
USING (true);

-- Enable RLS on company_favorites
ALTER TABLE public.company_favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for company_favorites
CREATE POLICY "Users can manage their own favorites" 
ON public.company_favorites 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to get company statistics
CREATE OR REPLACE FUNCTION public.get_company_statistics(p_company_id UUID)
RETURNS TABLE(
  total_employees INTEGER,
  years_in_business INTEGER,
  open_positions BIGINT,
  client_satisfaction_rating DECIMAL(3,2),
  total_reviews BIGINT,
  average_rating DECIMAL(3,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  company_incorporation_date DATE;
  calculated_years INTEGER;
  org_size TEXT;
  employee_count INTEGER;
BEGIN
  -- Get company incorporation date and organization size
  SELECT incorporation_date, organisation_size 
  INTO company_incorporation_date, org_size
  FROM companies 
  WHERE id = p_company_id;
  
  -- Calculate years in business
  IF company_incorporation_date IS NOT NULL THEN
    calculated_years := EXTRACT(YEAR FROM AGE(CURRENT_DATE, company_incorporation_date));
  ELSE
    calculated_years := 0;
  END IF;
  
  -- Parse employee count from organisation_size
  employee_count := CASE 
    WHEN org_size ILIKE '%1-10%' THEN 5
    WHEN org_size ILIKE '%11-50%' THEN 30
    WHEN org_size ILIKE '%51-200%' THEN 125
    WHEN org_size ILIKE '%201-500%' THEN 350
    WHEN org_size ILIKE '%501-1000%' THEN 750
    WHEN org_size ILIKE '%1000+%' THEN 2000
    ELSE 0
  END;
  
  RETURN QUERY
  SELECT 
    employee_count,
    calculated_years,
    (SELECT COUNT(*) FROM jobs WHERE company_id = p_company_id AND status = 'active'),
    COALESCE((SELECT AVG(rating::DECIMAL) FROM company_reviews WHERE company_id = p_company_id), 0.0),
    (SELECT COUNT(*) FROM company_reviews WHERE company_id = p_company_id),
    COALESCE((SELECT AVG(rating::DECIMAL) FROM company_reviews WHERE company_id = p_company_id), 0.0);
END;
$$;

-- Create function to get company reviews with pagination
CREATE OR REPLACE FUNCTION public.get_company_reviews(
  p_company_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  rating INTEGER,
  review_text TEXT,
  reviewer_name TEXT,
  reviewer_position TEXT,
  is_verified BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.rating,
    cr.review_text,
    cr.reviewer_name,
    cr.reviewer_position,
    cr.is_verified,
    cr.created_at
  FROM company_reviews cr
  WHERE cr.company_id = p_company_id
  ORDER BY cr.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Create function to check if user has favorited a company
CREATE OR REPLACE FUNCTION public.is_company_favorited(p_company_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_uuid UUID;
BEGIN
  user_uuid := COALESCE(p_user_id, auth.uid());
  
  IF user_uuid IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM company_favorites 
    WHERE company_id = p_company_id AND user_id = user_uuid
  );
END;
$$;

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION public.update_company_review_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_reviews_updated_at
BEFORE UPDATE ON public.company_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_company_review_timestamp();

CREATE TRIGGER update_company_statistics_updated_at
BEFORE UPDATE ON public.company_statistics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();