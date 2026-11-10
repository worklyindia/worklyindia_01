-- Create FAQs table for AI chat knowledge base
CREATE TABLE public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  relevance_score INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(question, '') || ' ' || coalesce(answer, '') || ' ' || coalesce(category, ''))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "FAQs are viewable by everyone"
ON public.faqs
FOR SELECT
USING (is_active = true);

-- Create policy for admin insert/update
CREATE POLICY "Admins can manage FAQs"
ON public.faqs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
  )
);

-- Create indexes for fast searching
CREATE INDEX idx_faqs_search ON public.faqs USING GIN(search_vector);
CREATE INDEX idx_faqs_category ON public.faqs(category) WHERE is_active = true;
CREATE INDEX idx_faqs_relevance ON public.faqs(relevance_score DESC) WHERE is_active = true;

-- Insert sample FAQ data
INSERT INTO public.faqs (category, question, answer, keywords, relevance_score) VALUES
('Application Process', 'How do I apply for a job?', 'To apply for a job on Workly India: 1) Browse jobs on the homepage or search page, 2) Click on a job listing to view details, 3) Click the "Apply Now" button, 4) Fill in your application details and upload your resume, 5) Submit your application. You will receive a confirmation once submitted.', ARRAY['apply', 'job', 'application', 'how to apply', 'submit'], 100),
('Application Process', 'Can I edit my application after submitting?', 'Unfortunately, you cannot edit your application after submission. However, you can contact the employer directly through the messaging system if you need to provide additional information or corrections.', ARRAY['edit', 'application', 'change', 'modify', 'after submit'], 90),
('Application Process', 'How do I track my applications?', 'You can track all your job applications by going to the "My Applications" section in your profile dashboard. There you will see the status of each application (pending, reviewing, shortlisted, rejected, accepted).', ARRAY['track', 'applications', 'status', 'check', 'my applications'], 95),
('Account & Profile', 'How do I create an account?', 'Creating an account on Workly India is easy: 1) Click "Sign Up" in the top right corner, 2) Enter your email and create a password, 3) Verify your email address, 4) Complete your profile with your details, skills, and experience. You can then start applying for jobs immediately.', ARRAY['account', 'signup', 'register', 'create account', 'new user'], 100),
('Account & Profile', 'How do I update my profile?', 'To update your profile: 1) Log in to your account, 2) Click on your profile icon in the top right, 3) Select "Profile Settings", 4) Edit your information including personal details, work experience, education, and skills, 5) Click "Save Changes".', ARRAY['profile', 'update', 'edit', 'change profile', 'settings'], 95),
('Account & Profile', 'I forgot my password. How do I reset it?', 'To reset your password: 1) Click "Login" on the homepage, 2) Click "Forgot Password?", 3) Enter your registered email address, 4) Check your email for a password reset link, 5) Follow the link and create a new password.', ARRAY['password', 'forgot', 'reset', 'recover', 'login issue'], 90),
('Payments & Refunds', 'Is it free to apply for jobs?', 'Yes! Job seekers can apply for jobs on Workly India completely free. There are no charges for creating an account, browsing jobs, or submitting applications. Only employers pay to post jobs and access premium features.', ARRAY['free', 'cost', 'price', 'charges', 'job seeker'], 100),
('Payments & Refunds', 'What payment methods do you accept?', 'For employers purchasing job posting credits or premium features, we accept: UPI, Credit/Debit Cards, Net Banking, and popular digital wallets through our secure payment gateway powered by Razorpay.', ARRAY['payment', 'methods', 'pay', 'razorpay', 'upi', 'card'], 85),
('Payments & Refunds', 'What is your refund policy?', 'Refunds are processed on a case-by-case basis. If you have purchased job credits and have not used them, you can request a refund within 7 days. For disputes or issues, please contact our support team at support@worklyindia.devs.surf.', ARRAY['refund', 'money back', 'cancellation', 'dispute', 'return'], 80),
('Platform Features', 'What makes Workly India different from other job portals?', 'Workly India specializes exclusively in remote and work-from-home opportunities in India. We offer: 1) Curated remote jobs from verified companies, 2) AI-powered job matching, 3) Real-time chat with employers, 4) Video interview scheduling, 5) Skill assessments and certifications, 6) Free for job seekers with no hidden charges.', ARRAY['features', 'benefits', 'why Workly India', 'difference', 'advantages'], 100),
('Platform Features', 'Can I search for jobs by location?', 'Yes! Even though all jobs on Workly India are remote/work-from-home positions, many employers prefer candidates from specific cities or states. You can filter jobs by location, experience level, job type, category, and salary range using our advanced search filters.', ARRAY['search', 'filter', 'location', 'find jobs', 'browse'], 90),
('Platform Features', 'Do you have a mobile app?', 'Yes! Workly India is available on both Android and iOS. You can download our mobile app from Google Play Store or Apple App Store. The app includes all features like job browsing, applications, messaging, and notifications.', ARRAY['mobile', 'app', 'android', 'ios', 'download'], 85),
('For Employers', 'How do I post a job?', 'To post a job on Workly India: 1) Create an employer account, 2) Complete your company profile, 3) Purchase job posting credits, 4) Click "Post a Job", 5) Fill in job details including title, description, requirements, salary, 6) Review and publish. Your job will be live immediately after approval.', ARRAY['post job', 'employer', 'hire', 'create job', 'recruiter'], 95),
('For Employers', 'How much does it cost to post a job?', 'Job posting pricing varies based on duration and visibility. We offer flexible packages: Basic job posts start from ₹999 for 30 days, Premium posts with featured placement from ₹2,499, and Enterprise packages with additional benefits. Contact sales for custom pricing.', ARRAY['cost', 'price', 'employer pricing', 'job post cost', 'charges'], 90),
('For Employers', 'Can I contact candidates directly?', 'Yes! Once a candidate applies to your job, you can message them directly through our platform chat system. You can also schedule video interviews, request additional information, or share offer letters through the platform.', ARRAY['contact', 'message', 'chat', 'candidate', 'communication'], 85),
('Technical Support', 'I am facing a technical issue. Who do I contact?', 'For technical support: 1) Check our Help Center for common solutions, 2) Use the AI chat assistant on the website for instant help, 3) Email support@worklyindia.devs.surf with details of your issue, 4) For urgent matters, use the live chat during business hours (9 AM - 6 PM IST, Monday-Saturday).', ARRAY['support', 'help', 'issue', 'problem', 'technical', 'contact'], 100),
('Technical Support', 'Why am I not receiving email notifications?', 'If you are not receiving email notifications: 1) Check your spam/junk folder, 2) Add noreply@worklyindia.devs.surf to your safe senders list, 3) Verify your email address in profile settings, 4) Check notification preferences to ensure email notifications are enabled. If issues persist, contact support.', ARRAY['email', 'notifications', 'not receiving', 'spam', 'alerts'], 85);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_faqs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_faqs_updated_at
BEFORE UPDATE ON public.faqs
FOR EACH ROW
EXECUTE FUNCTION public.update_faqs_updated_at();