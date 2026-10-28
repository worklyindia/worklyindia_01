-- Create recruitment solutions table
CREATE TABLE IF NOT EXISTS public.recruitment_solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  features TEXT[] NOT NULL DEFAULT '{}',
  icon_name TEXT NOT NULL,
  price TEXT NOT NULL,
  is_popular BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recruitment packages table
CREATE TABLE IF NOT EXISTS public.recruitment_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  period TEXT NOT NULL,
  description TEXT NOT NULL,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_recommended BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recruitment testimonials table
CREATE TABLE IF NOT EXISTS public.recruitment_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  company TEXT NOT NULL,
  feedback TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create recruitment inquiries table
CREATE TABLE IF NOT EXISTS public.recruitment_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  message TEXT NOT NULL,
  inquiry_type TEXT NOT NULL, -- 'demo', 'contact_sales', 'get_started', 'case_study'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'contacted', 'closed'
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recruitment_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_inquiries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recruitment_solutions
CREATE POLICY "Anyone can view active solutions"
  ON public.recruitment_solutions FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage solutions"
  ON public.recruitment_solutions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for recruitment_packages
CREATE POLICY "Anyone can view active packages"
  ON public.recruitment_packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage packages"
  ON public.recruitment_packages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for recruitment_testimonials
CREATE POLICY "Anyone can view active testimonials"
  ON public.recruitment_testimonials FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage testimonials"
  ON public.recruitment_testimonials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- RLS Policies for recruitment_inquiries
CREATE POLICY "Anyone can create inquiries"
  ON public.recruitment_inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own inquiries"
  ON public.recruitment_inquiries FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can manage all inquiries"
  ON public.recruitment_inquiries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Create indexes
CREATE INDEX idx_recruitment_solutions_active ON public.recruitment_solutions(is_active, display_order);
CREATE INDEX idx_recruitment_packages_active ON public.recruitment_packages(is_active, display_order);
CREATE INDEX idx_recruitment_testimonials_active ON public.recruitment_testimonials(is_active);
CREATE INDEX idx_recruitment_inquiries_status ON public.recruitment_inquiries(status, created_at);

-- Seed recruitment solutions data
INSERT INTO public.recruitment_solutions (title, description, features, icon_name, price, is_popular, display_order) VALUES
('Volume Hiring', 'Efficiently hire large numbers of candidates for seasonal or expansion needs', ARRAY['Automated screening', 'Bulk interview scheduling', 'Quick onboarding', 'Progress tracking'], 'Users', 'Custom Pricing', false, 1),
('Executive Search', 'Find and recruit top-level executives and senior management positions', ARRAY['Headhunting services', 'Confidential search', 'Executive assessment', 'Success guarantee'], 'Target', 'Premium Service', true, 2),
('Tech Recruitment', 'Specialized recruitment for technical roles and IT positions', ARRAY['Technical screening', 'Coding assessments', 'Portfolio review', 'Cultural fit analysis'], 'Zap', 'Starting ₹50K', false, 3),
('Campus Recruitment', 'Connect with fresh graduates from top colleges and universities', ARRAY['Campus partnerships', 'Student assessments', 'Internship programs', 'Graduate tracking'], 'Award', 'Package deals', false, 4);

-- Seed recruitment packages data
INSERT INTO public.recruitment_packages (name, price, period, description, features, is_recommended, display_order) VALUES
('Starter', '₹25,000', 'per month', 'Perfect for small businesses starting their recruitment journey', ARRAY['Up to 5 job postings', 'Basic candidate screening', 'Email support', 'Standard reporting', '30-day guarantee'], false, 1),
('Professional', '₹75,000', 'per month', 'Ideal for growing companies with regular hiring needs', ARRAY['Up to 20 job postings', 'Advanced screening tools', 'Priority support', 'Custom reporting', '60-day guarantee', 'Dedicated account manager'], true, 2),
('Enterprise', 'Custom', 'contact us', 'Comprehensive solution for large organizations', ARRAY['Unlimited job postings', 'AI-powered matching', '24/7 premium support', 'Advanced analytics', '90-day guarantee', 'Multiple account managers', 'Custom integrations'], false, 3);

-- Seed recruitment testimonials data
INSERT INTO public.recruitment_testimonials (name, position, company, feedback, rating, is_verified) VALUES
('Rajesh Kumar', 'HR Director', 'TechCorp Solutions', 'Their recruitment solutions helped us scale our team efficiently. The quality of candidates was excellent.', 5, true),
('Priya Sharma', 'Talent Acquisition Lead', 'Digital Innovations', 'The executive search service found us the perfect CTO. Their process was thorough and professional.', 5, true),
('Amit Patel', 'Founder', 'StartUp Hub', 'Great support for our startup hiring needs. They understood our culture and found candidates that fit perfectly.', 4, true),
('Sneha Reddy', 'VP Operations', 'Manufacturing Co', 'Volume hiring solution was a game-changer for our seasonal workforce needs. Highly recommended!', 5, true),
('Vikram Singh', 'CEO', 'FinTech Ventures', 'Professional service from start to finish. They delivered quality candidates within our tight timeline.', 5, true);