-- Create skill assessment tables

-- 1. Skill Categories Table
CREATE TABLE public.skill_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  duration TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Skill Assessments Table
CREATE TABLE public.skill_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.skill_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  difficulty TEXT NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 0,
  passing_score INTEGER NOT NULL DEFAULT 70,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Assessment Questions Table
CREATE TABLE public.assessment_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.skill_assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer_index INTEGER NOT NULL,
  explanation TEXT,
  difficulty TEXT NOT NULL DEFAULT 'intermediate',
  points INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. User Assessment Attempts Table
CREATE TABLE public.user_assessment_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.skill_assessments(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  score INTEGER,
  correct_answers INTEGER,
  total_questions INTEGER NOT NULL,
  time_taken_minutes INTEGER,
  answers JSONB DEFAULT '[]'::jsonb,
  certificate_issued BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. User Certificates Table
CREATE TABLE public.user_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.skill_assessments(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.user_assessment_attempts(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  skill_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  level TEXT NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  verification_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.skill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_certificates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for skill_categories
CREATE POLICY "Anyone can view active categories"
  ON public.skill_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage categories"
  ON public.skill_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for skill_assessments
CREATE POLICY "Anyone can view active assessments"
  ON public.skill_assessments FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage assessments"
  ON public.skill_assessments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for assessment_questions
CREATE POLICY "Anyone can view questions for active assessments"
  ON public.assessment_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.skill_assessments
      WHERE id = assessment_questions.assessment_id AND is_active = true
    )
  );

CREATE POLICY "Admins can manage questions"
  ON public.assessment_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for user_assessment_attempts
CREATE POLICY "Users can view their own attempts"
  ON public.user_assessment_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attempts"
  ON public.user_assessment_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts"
  ON public.user_assessment_attempts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attempts"
  ON public.user_assessment_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for user_certificates
CREATE POLICY "Users can view their own certificates"
  ON public.user_certificates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can verify certificates"
  ON public.user_certificates FOR SELECT
  USING (true);

CREATE POLICY "System can issue certificates"
  ON public.user_certificates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage certificates"
  ON public.user_certificates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_skill_assessments_category ON public.skill_assessments(category_id);
CREATE INDEX idx_assessment_questions_assessment ON public.assessment_questions(assessment_id);
CREATE INDEX idx_user_attempts_user ON public.user_assessment_attempts(user_id);
CREATE INDEX idx_user_attempts_assessment ON public.user_assessment_attempts(assessment_id);
CREATE INDEX idx_user_certificates_user ON public.user_certificates(user_id);
CREATE INDEX idx_user_certificates_number ON public.user_certificates(certificate_number);

-- Function to generate certificate number
CREATE OR REPLACE FUNCTION generate_certificate_number()
RETURNS TEXT AS $$
DECLARE
  cert_number TEXT;
BEGIN
  cert_number := 'WFH-CERT-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
  RETURN cert_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_skill_categories_updated_at
  BEFORE UPDATE ON public.skill_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skill_assessments_updated_at
  BEFORE UPDATE ON public.skill_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert seed data for categories
INSERT INTO public.skill_categories (title, slug, description, icon_name, difficulty, duration, display_order) VALUES
('Technical Skills', 'technical-skills', 'Programming, software tools, and technical knowledge', 'Code', 'Beginner to Advanced', '15-30 mins', 1),
('Analytical Skills', 'analytical-skills', 'Problem-solving, logical thinking, and data interpretation', 'Brain', 'Intermediate', '20-25 mins', 2),
('Communication Skills', 'communication-skills', 'Written and verbal communication, presentation skills', 'Presentation', 'All Levels', '10-15 mins', 3),
('Creative Skills', 'creative-skills', 'Design thinking, creativity, and innovation', 'Palette', 'Beginner to Advanced', '15-20 mins', 4);

-- Insert seed assessments
INSERT INTO public.skill_assessments (category_id, title, slug, description, difficulty, total_questions, passing_score, duration_minutes) 
SELECT 
  (SELECT id FROM public.skill_categories WHERE slug = 'technical-skills'),
  'JavaScript', 'javascript', 'Test your JavaScript fundamentals and ES6+ knowledge', 'Intermediate', 10, 70, 20
UNION ALL SELECT
  (SELECT id FROM public.skill_categories WHERE slug = 'technical-skills'),
  'Python', 'python', 'Assess your Python programming skills', 'Beginner', 10, 70, 20
UNION ALL SELECT
  (SELECT id FROM public.skill_categories WHERE slug = 'technical-skills'),
  'React', 'react', 'Evaluate your React.js development expertise', 'Advanced', 10, 70, 25
UNION ALL SELECT
  (SELECT id FROM public.skill_categories WHERE slug = 'technical-skills'),
  'SQL', 'sql', 'Test your database query and design knowledge', 'Intermediate', 10, 70, 20
UNION ALL SELECT
  (SELECT id FROM public.skill_categories WHERE slug = 'analytical-skills'),
  'Problem Solving', 'problem-solving', 'Evaluate your analytical and problem-solving abilities', 'Intermediate', 10, 70, 25
UNION ALL SELECT
  (SELECT id FROM public.skill_categories WHERE slug = 'analytical-skills'),
  'Critical Thinking', 'critical-thinking', 'Test your logical reasoning and critical analysis', 'Intermediate', 10, 70, 20
UNION ALL SELECT
  (SELECT id FROM public.skill_categories WHERE slug = 'communication-skills'),
  'Written Communication', 'written-communication', 'Assess your writing and documentation skills', 'All Levels', 10, 70, 15
UNION ALL SELECT
  (SELECT id FROM public.skill_categories WHERE slug = 'communication-skills'),
  'Public Speaking', 'public-speaking', 'Evaluate your presentation and speaking abilities', 'All Levels', 10, 70, 15
UNION ALL SELECT
  (SELECT id FROM public.skill_categories WHERE slug = 'creative-skills'),
  'UI/UX Design', 'ui-ux-design', 'Test your design thinking and user experience knowledge', 'Intermediate', 10, 70, 20
UNION ALL SELECT
  (SELECT id FROM public.skill_categories WHERE slug = 'creative-skills'),
  'Creative Problem Solving', 'creative-problem-solving', 'Assess your innovative thinking abilities', 'Intermediate', 10, 70, 20;

-- Insert sample questions for JavaScript assessment
INSERT INTO public.assessment_questions (assessment_id, question_text, options, correct_answer_index, explanation, difficulty, display_order)
SELECT 
  (SELECT id FROM public.skill_assessments WHERE slug = 'javascript'),
  'What is the output of the following JavaScript code? console.log(typeof null);',
  '[{"text": "null", "value": "null"}, {"text": "undefined", "value": "undefined"}, {"text": "object", "value": "object"}, {"text": "string", "value": "string"}]'::jsonb,
  2,
  'In JavaScript, typeof null returns "object". This is actually a known bug in JavaScript that has been kept for backwards compatibility.',
  'intermediate',
  1
UNION ALL SELECT
  (SELECT id FROM public.skill_assessments WHERE slug = 'javascript'),
  'Which method is used to add elements to the end of an array?',
  '[{"text": "push()", "value": "push"}, {"text": "pop()", "value": "pop"}, {"text": "shift()", "value": "shift"}, {"text": "unshift()", "value": "unshift"}]'::jsonb,
  0,
  'The push() method adds one or more elements to the end of an array and returns the new length of the array.',
  'beginner',
  2
UNION ALL SELECT
  (SELECT id FROM public.skill_assessments WHERE slug = 'javascript'),
  'What does the "use strict" directive do?',
  '[{"text": "Makes code run faster", "value": "faster"}, {"text": "Enables strict mode parsing", "value": "strict"}, {"text": "Prevents variable declarations", "value": "prevent"}, {"text": "Enables ES6 features", "value": "es6"}]'::jsonb,
  1,
  '"use strict" enables strict mode, which catches common coding errors and prevents certain actions.',
  'intermediate',
  3;