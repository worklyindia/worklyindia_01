-- Create career_paths table
CREATE TABLE public.career_paths (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  growth_rate TEXT NOT NULL DEFAULT 'Medium',
  avg_salary_min INTEGER NOT NULL,
  avg_salary_max INTEGER NOT NULL,
  popular_roles TEXT[] NOT NULL DEFAULT '{}',
  key_skills TEXT[] NOT NULL DEFAULT '{}',
  icon_name TEXT,
  job_category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;

-- RLS Policies for career_paths
CREATE POLICY "Anyone can view active career paths"
  ON public.career_paths
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage career paths"
  ON public.career_paths
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('admin', 'owner')
    )
  );

-- Create career_planning_progress table
CREATE TABLE public.career_planning_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, step_number)
);

-- Enable RLS
ALTER TABLE public.career_planning_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for career_planning_progress
CREATE POLICY "Users can view their own progress"
  ON public.career_planning_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own progress"
  ON public.career_planning_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.career_planning_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Seed career paths data
INSERT INTO public.career_paths (title, slug, description, growth_rate, avg_salary_min, avg_salary_max, popular_roles, key_skills, icon_name, job_category, display_order) VALUES
('Technology', 'technology', 'Build the digital future with cutting-edge tech skills', 'High', 800000, 2500000, ARRAY['Software Developer', 'Data Scientist', 'DevOps Engineer', 'UI/UX Designer'], ARRAY['Programming', 'Problem Solving', 'Continuous Learning'], 'Code', 'Technology', 1),
('Marketing', 'marketing', 'Drive business growth through creative marketing strategies', 'Medium', 400000, 1500000, ARRAY['Digital Marketer', 'Content Writer', 'SEO Specialist', 'Brand Manager'], ARRAY['Creativity', 'Analytics', 'Communication'], 'TrendingUp', 'Marketing', 2),
('Finance', 'finance', 'Manage wealth and drive financial success', 'Stable', 600000, 2000000, ARRAY['Financial Analyst', 'Investment Banker', 'Accountant', 'Risk Manager'], ARRAY['Analytical Thinking', 'Attention to Detail', 'Ethics'], 'DollarSign', 'Finance', 3),
('Healthcare', 'healthcare', 'Make a difference in peoples lives through healthcare', 'High', 500000, 3000000, ARRAY['Doctor', 'Nurse', 'Pharmacist', 'Medical Technician'], ARRAY['Empathy', 'Precision', 'Continuous Learning'], 'Heart', 'Healthcare', 4),
('Design', 'design', 'Create beautiful and functional user experiences', 'High', 400000, 1800000, ARRAY['UI/UX Designer', 'Graphic Designer', 'Product Designer', 'Motion Designer'], ARRAY['Creativity', 'User Empathy', 'Visual Communication'], 'Palette', 'Design', 5),
('Sales', 'sales', 'Drive revenue and build lasting customer relationships', 'Medium', 400000, 2000000, ARRAY['Sales Executive', 'Business Development', 'Account Manager', 'Sales Manager'], ARRAY['Communication', 'Negotiation', 'Relationship Building'], 'Users', 'Sales', 6),
('Education', 'education', 'Shape the future by educating the next generation', 'Stable', 300000, 1200000, ARRAY['Teacher', 'Trainer', 'Educational Consultant', 'Content Developer'], ARRAY['Communication', 'Patience', 'Subject Expertise'], 'BookOpen', 'Education', 7),
('Manufacturing', 'manufacturing', 'Build products that power the economy', 'Medium', 400000, 1500000, ARRAY['Production Manager', 'Quality Engineer', 'Supply Chain Manager', 'Operations Manager'], ARRAY['Process Optimization', 'Quality Control', 'Leadership'], 'Factory', 'Operations', 8);

-- Create indexes
CREATE INDEX idx_career_paths_slug ON public.career_paths(slug);
CREATE INDEX idx_career_paths_active ON public.career_paths(is_active, display_order);
CREATE INDEX idx_career_planning_user ON public.career_planning_progress(user_id, step_number);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_career_paths_updated_at
  BEFORE UPDATE ON public.career_paths
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_career_planning_progress_updated_at
  BEFORE UPDATE ON public.career_planning_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();