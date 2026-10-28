-- Populate sample data for Workly India platform

-- First, let's add more realistic companies
INSERT INTO companies (user_id, company_name, industry, company_size, location, website, description, logo_url, is_verified, is_profile_complete) VALUES
  -- Generate sample user_ids (these should be actual auth.users IDs in production)
  (gen_random_uuid(), 'TechSoft Solutions', 'Information Technology', '51-200', 'Bangalore, Karnataka', 'https://techsoft.com', 'Leading software development company specializing in Workly India solutions', '/lovable-uploads/02ca049f-e317-4ffd-b63c-4af9844f21ed.png', true, true),
  (gen_random_uuid(), 'Digital Marketing Hub', 'Marketing & Advertising', '11-50', 'Delhi, NCR', 'https://dmhub.com', 'Full-service digital marketing agency helping businesses grow online', '/lovable-uploads/58fe7a08-f669-4766-a8a3-4a14470ff791.png', true, true),
  (gen_random_uuid(), 'Content Creation Studio', 'Media & Entertainment', '11-50', 'Mumbai, Maharashtra', 'https://contentcreation.com', 'Creative content agency specializing in video, writing, and social media content', '/lovable-uploads/95e6c7e0-54e1-4b48-af3e-382152dbf631.png', true, true),
  (gen_random_uuid(), 'Virtual Assistant Pro', 'Business Services', '51-200', 'Pune, Maharashtra', 'https://vapro.com', 'Professional virtual assistant services for businesses worldwide', '/lovable-uploads/e6842375-3aac-4daa-a379-8b60152cbf1d.png', true, true),
  (gen_random_uuid(), 'DataEntry Masters', 'Data Processing', '11-50', 'Chennai, Tamil Nadu', 'https://dataentry.com', 'Reliable data entry and processing services with 99% accuracy guarantee', null, true, true),
  (gen_random_uuid(), 'Customer Care Plus', 'Customer Service', '201-500', 'Hyderabad, Telangana', 'https://customercare.com', 'Premium customer support services available 24/7 across multiple channels', null, true, true),
  (gen_random_uuid(), 'EduTech Solutions', 'Education Technology', '51-200', 'Kolkata, West Bengal', 'https://edutech.com', 'Online education platform creating innovative learning experiences', null, false, true);

-- Now let's add diverse job postings across different categories
INSERT INTO jobs (company_id, title, location, job_type, experience_level, salary_range, description, requirements, benefits, skills, category, status, is_boosted, boost_level, trending_score) 
SELECT 
  c.id,
  job_data.title,
  job_data.location,
  job_data.job_type,
  job_data.experience_level,
  job_data.salary_range,
  job_data.description,
  job_data.requirements,
  job_data.benefits,
  job_data.skills,
  job_data.category,
  'active',
  job_data.is_boosted,
  job_data.boost_level,
  job_data.trending_score
FROM companies c
CROSS JOIN (
  VALUES 
    -- Customer Support Jobs
    ('Customer Support Executive', 'Remote (India)', 'full-time', 'fresher', '₹15,000 - ₹25,000/month', 'Handle customer queries via chat, email, and phone. Provide excellent customer service and resolve issues promptly.', 'Good communication skills in English and Hindi, Basic computer knowledge, Patience and problem-solving skills', 'Health insurance, Flexible working hours, Performance bonuses, Professional development', ARRAY['Customer Service', 'Communication', 'Problem Solving', 'Hindi', 'English'], 'Customer Support', false, 0, 85),
    ('Technical Support Specialist', 'Remote (India)', 'full-time', '1-3 years', '₹20,000 - ₹35,000/month', 'Provide technical support to customers, troubleshoot software issues, and maintain customer satisfaction.', '1-2 years technical support experience, Basic IT knowledge, Excellent communication skills', 'Medical insurance, Workly India allowance, Flexible schedule, Career growth opportunities', ARRAY['Technical Support', 'Troubleshooting', 'Customer Service', 'IT Support'], 'Customer Support', true, 2, 120),
    
    -- Data Entry Jobs  
    ('Data Entry Operator', 'Remote (India)', 'part-time', 'fresher', '₹8,000 - ₹15,000/month', 'Accurate data entry from various sources into databases and spreadsheets. Maintain data quality and meet daily targets.', 'Fast typing speed (35+ WPM), Attention to detail, Basic Excel knowledge, High school education', 'Flexible hours, Performance incentives, Skills training, Work-life balance', ARRAY['Data Entry', 'Excel', 'Typing', 'Attention to Detail'], 'Data Entry', false, 0, 75),
    ('Data Processing Executive', 'Remote (India)', 'full-time', '1-3 years', '₹18,000 - ₹28,000/month', 'Process and verify large datasets, ensure data accuracy, and prepare reports for management review.', '1+ years data processing experience, Advanced Excel skills, Knowledge of databases, Analytical mindset', 'Health benefits, Paid training, Flexible working hours, Performance bonuses', ARRAY['Data Processing', 'Excel', 'Database', 'Analytics'], 'Data Entry', false, 0, 65),
    
    -- Content Writing Jobs
    ('Content Writer', 'Remote (India)', 'full-time', '1-3 years', '₹20,000 - ₹40,000/month', 'Create engaging content for websites, blogs, social media, and marketing materials. Research topics and write SEO-optimized content.', 'Excellent English writing skills, SEO knowledge, Research abilities, Portfolio of written work', 'Creative freedom, Flexible schedule, Learning opportunities, Performance incentives', ARRAY['Content Writing', 'SEO', 'Research', 'English', 'Blogging'], 'Content Writing', true, 1, 95),
    ('Copywriter', 'Remote (India)', 'full-time', '1-3 years', '₹25,000 - ₹45,000/month', 'Write compelling copy for advertisements, marketing campaigns, and promotional materials. Create content that drives conversions.', '2+ years copywriting experience, Marketing knowledge, Creative thinking, Portfolio required', 'Competitive salary, Creative projects, Flexible hours, Health insurance', ARRAY['Copywriting', 'Marketing', 'Creative Writing', 'Advertising'], 'Content Writing', false, 0, 80),
    
    -- Virtual Assistant Jobs
    ('Virtual Assistant', 'Remote (India)', 'part-time', 'fresher', '₹12,000 - ₹22,000/month', 'Provide administrative support including email management, scheduling, research, and basic bookkeeping tasks.', 'Good organizational skills, Professional communication, Basic computer skills, Time management', 'Flexible schedule, Skill development, Work-life balance, Growth opportunities', ARRAY['Virtual Assistant', 'Administration', 'Organization', 'Communication'], 'Virtual Assistant', false, 0, 70),
    ('Executive Assistant (Remote)', 'Remote (India)', 'full-time', '3-5 years', '₹30,000 - ₹50,000/month', 'Support senior executives with complex administrative tasks, project coordination, and stakeholder communication.', '3+ years executive support experience, Advanced MS Office skills, Excellent communication, Discretion and professionalism', 'Premium health insurance, Professional development, Flexible working, Performance bonuses', ARRAY['Executive Support', 'Project Management', 'Communication', 'MS Office'], 'Virtual Assistant', true, 2, 110),
    
    -- Digital Marketing Jobs
    ('Digital Marketing Executive', 'Remote (India)', 'full-time', '1-3 years', '₹22,000 - ₹38,000/month', 'Manage social media campaigns, create marketing content, analyze performance metrics, and optimize digital strategies.', '1+ years digital marketing experience, Social media expertise, Google Ads knowledge, Analytics skills', 'Creative environment, Learning budget, Flexible hours, Performance incentives', ARRAY['Digital Marketing', 'Social Media', 'Google Ads', 'Analytics'], 'Digital Marketing', true, 1, 100),
    ('SEO Specialist', 'Remote (India)', 'full-time', '2-4 years', '₹25,000 - ₹45,000/month', 'Optimize websites for search engines, conduct keyword research, analyze SEO performance, and implement improvement strategies.', '2+ years SEO experience, Technical SEO knowledge, Google Analytics, Content optimization skills', 'Skill enhancement programs, Results-based bonuses, Workly India setup allowance, Health benefits', ARRAY['SEO', 'Google Analytics', 'Keyword Research', 'Technical SEO'], 'Digital Marketing', false, 0, 85),
    
    -- Software Development Jobs
    ('Junior Web Developer', 'Remote (India)', 'full-time', '1-3 years', '₹30,000 - ₹55,000/month', 'Develop and maintain websites using modern technologies. Work on both frontend and backend development projects.', '1+ years web development experience, HTML/CSS/JavaScript, React or Angular, Basic backend knowledge', 'Latest technology exposure, Mentorship program, Flexible schedule, Health insurance', ARRAY['Web Development', 'JavaScript', 'React', 'HTML/CSS'], 'Software Development', true, 2, 130),
    ('Python Developer', 'Remote (India)', 'full-time', '2-4 years', '₹40,000 - ₹70,000/month', 'Develop Python applications, work with databases, create APIs, and collaborate with cross-functional teams.', '2+ years Python experience, Django/Flask framework, Database knowledge, API development', 'Competitive salary, Latest tools, Learning opportunities, Work-life balance', ARRAY['Python', 'Django', 'API Development', 'Database'], 'Software Development', false, 0, 95)
) AS job_data (title, location, job_type, experience_level, salary_range, description, requirements, benefits, skills, category, is_boosted, boost_level, trending_score)
WHERE c.company_name IN ('Customer Care Plus', 'DataEntry Masters', 'Content Creation Studio', 'Virtual Assistant Pro', 'Digital Marketing Hub', 'TechSoft Solutions', 'EduTech Solutions');

-- Add more realistic user profiles for testing
INSERT INTO profiles (user_id, full_name, phone, location, current_position, experience_years, skills, education, bio, is_profile_complete, preferred_location, job_type, industry) VALUES
  (gen_random_uuid(), 'Priya Sharma', '+91-9876543210', 'Mumbai, Maharashtra', 'Customer Support Executive', 2, ARRAY['Customer Service', 'Communication', 'Problem Solving', 'Hindi', 'English'], 'BCA from Mumbai University', 'Experienced customer support professional with excellent communication skills and proven track record in handling customer queries.', true, 'Remote (India)', 'full-time', 'Customer Support'),
  (gen_random_uuid(), 'Rahul Kumar', '+91-8765432109', 'Delhi, NCR', 'Content Writer', 3, ARRAY['Content Writing', 'SEO', 'Research', 'English', 'Blogging'], 'BA English Literature from Delhi University', 'Creative content writer specializing in SEO-optimized articles, blog posts, and marketing content with 3+ years experience.', true, 'Remote (India)', 'full-time', 'Content Writing'),
  (gen_random_uuid(), 'Sneha Patel', '+91-7654321098', 'Bangalore, Karnataka', 'Web Developer', 4, ARRAY['JavaScript', 'React', 'HTML/CSS', 'Node.js'], 'B.Tech Computer Science from VTU', 'Full-stack web developer with expertise in modern JavaScript frameworks and passionate about creating user-friendly applications.', true, 'Remote (India)', 'full-time', 'Software Development'),
  (gen_random_uuid(), 'Amit Singh', '+91-6543210987', 'Pune, Maharashtra', 'Digital Marketing Specialist', 2, ARRAY['Digital Marketing', 'Google Ads', 'Social Media', 'Analytics'], 'MBA Marketing from Pune University', 'Digital marketing professional with proven success in campaign management, social media marketing, and performance optimization.', true, 'Remote (India)', 'full-time', 'Digital Marketing'),
  (gen_random_uuid(), 'Kavya Reddy', '+91-5432109876', 'Hyderabad, Telangana', 'Virtual Assistant', 1, ARRAY['Virtual Assistant', 'Administration', 'MS Office', 'Communication'], 'B.Com from Osmania University', 'Detail-oriented virtual assistant with strong organizational skills and experience in providing comprehensive administrative support.', true, 'Remote (India)', 'part-time', 'Virtual Assistant');

-- Add some job interactions to make jobs look active
INSERT INTO job_interactions (job_id, user_id, interaction_type, metadata)
SELECT 
  j.id,
  p.user_id,
  'view',
  jsonb_build_object('timestamp', NOW(), 'source', 'job_search')
FROM jobs j
CROSS JOIN profiles p
WHERE j.status = 'active' 
  AND random() < 0.3 -- 30% chance of interaction
LIMIT 50;

-- Update job counters based on interactions
UPDATE jobs 
SET views_count = (
  SELECT COUNT(*) 
  FROM job_interactions 
  WHERE job_id = jobs.id AND interaction_type = 'view'
),
trending_score = GREATEST(trending_score, (
  SELECT COUNT(*) * 2
  FROM job_interactions 
  WHERE job_id = jobs.id AND interaction_type = 'view'
));

-- Add some points transactions for testing payment system
INSERT INTO points_transactions (user_id, transaction_type, description, points_amount, points_balance_after)
SELECT 
  p.user_id,
  'purchase',
  'Bought 100 points package',
  100,
  100
FROM profiles p
WHERE p.is_profile_complete = true
LIMIT 3;

-- Add some job applications to make the system look active
INSERT INTO job_applications (job_id, user_id, cover_letter, status)
SELECT 
  j.id,
  p.user_id,
  'I am very interested in this position and believe my skills align perfectly with your requirements. I have relevant experience and am excited about the opportunity to contribute to your team.',
  CASE 
    WHEN random() < 0.1 THEN 'hired'
    WHEN random() < 0.2 THEN 'shortlisted' 
    WHEN random() < 0.3 THEN 'rejected'
    ELSE 'applied'
  END
FROM jobs j
CROSS JOIN profiles p
WHERE j.status = 'active' 
  AND p.is_profile_complete = true
  AND random() < 0.2 -- 20% application rate
LIMIT 25;

-- Update application counts
UPDATE jobs 
SET applications_count = (
  SELECT COUNT(*) 
  FROM job_applications 
  WHERE job_id = jobs.id
);

-- Add some job favorites
INSERT INTO job_favorites (user_id, job_id)
SELECT DISTINCT
  p.user_id,
  j.id
FROM profiles p
CROSS JOIN jobs j
WHERE j.status = 'active' 
  AND p.is_profile_complete = true
  AND random() < 0.15 -- 15% favorite rate
LIMIT 20;

-- Add notifications for job applications and new jobs
INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
SELECT 
  p.user_id,
  'New Job Alert',
  'New ' || j.title || ' position available at ' || c.company_name,
  'job_alert',
  '/job/' || j.id,
  jsonb_build_object('job_id', j.id, 'job_title', j.title, 'company', c.company_name)
FROM profiles p
CROSS JOIN jobs j
LEFT JOIN companies c ON j.company_id = c.id
WHERE j.status = 'active' 
  AND p.is_profile_complete = true
  AND j.created_at > NOW() - INTERVAL '7 days'
  AND random() < 0.3 -- 30% notification rate
LIMIT 15;