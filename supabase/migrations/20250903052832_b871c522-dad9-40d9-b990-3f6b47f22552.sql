-- Add sample jobs to existing companies to populate the platform
-- First let's see what companies already exist
WITH existing_companies AS (
  SELECT id, company_name FROM companies WHERE is_profile_complete = true
)
INSERT INTO jobs (company_id, title, location, job_type, experience_level, salary_range, description, requirements, benefits, skills, category, status, is_boosted, boost_level, trending_score, views_count, applications_count) 
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
  job_data.trending_score,
  job_data.views_count,
  job_data.applications_count
FROM existing_companies c
CROSS JOIN (
  VALUES 
    -- Customer Support Jobs
    ('Customer Support Executive', 'Remote (India)', 'full-time', 'fresher', '₹15,000 - ₹25,000/month', 'Handle customer queries via chat, email, and phone. Provide excellent customer service and resolve issues promptly.', 'Good communication skills in English and Hindi, Basic computer knowledge, Patience and problem-solving skills', 'Health insurance, Flexible working hours, Performance bonuses, Professional development', ARRAY['Customer Service', 'Communication', 'Problem Solving', 'Hindi', 'English'], 'Customer Support', false, 0, 85, 45, 8),
    ('Technical Support Specialist', 'Remote (India)', 'full-time', '1-3 years', '₹20,000 - ₹35,000/month', 'Provide technical support to customers, troubleshoot software issues, and maintain customer satisfaction.', '1-2 years technical support experience, Basic IT knowledge, Excellent communication skills', 'Medical insurance, Workly India allowance, Flexible schedule, Career growth opportunities', ARRAY['Technical Support', 'Troubleshooting', 'Customer Service', 'IT Support'], 'Customer Support', true, 2, 120, 78, 15),
    
    -- Data Entry Jobs  
    ('Data Entry Operator', 'Remote (India)', 'part-time', 'fresher', '₹8,000 - ₹15,000/month', 'Accurate data entry from various sources into databases and spreadsheets. Maintain data quality and meet daily targets.', 'Fast typing speed (35+ WPM), Attention to detail, Basic Excel knowledge, High school education', 'Flexible hours, Performance incentives, Skills training, Work-life balance', ARRAY['Data Entry', 'Excel', 'Typing', 'Attention to Detail'], 'Data Entry', false, 0, 75, 32, 5),
    ('Data Processing Executive', 'Remote (India)', 'full-time', '1-3 years', '₹18,000 - ₹28,000/month', 'Process and verify large datasets, ensure data accuracy, and prepare reports for management review.', '1+ years data processing experience, Advanced Excel skills, Knowledge of databases, Analytical mindset', 'Health benefits, Paid training, Flexible working hours, Performance bonuses', ARRAY['Data Processing', 'Excel', 'Database', 'Analytics'], 'Data Entry', false, 0, 65, 28, 4),
    
    -- Content Writing Jobs
    ('Content Writer', 'Remote (India)', 'full-time', '1-3 years', '₹20,000 - ₹40,000/month', 'Create engaging content for websites, blogs, social media, and marketing materials. Research topics and write SEO-optimized content.', 'Excellent English writing skills, SEO knowledge, Research abilities, Portfolio of written work', 'Creative freedom, Flexible schedule, Learning opportunities, Performance incentives', ARRAY['Content Writing', 'SEO', 'Research', 'English', 'Blogging'], 'Content Writing', true, 1, 95, 67, 12),
    ('Copywriter', 'Remote (India)', 'full-time', '1-3 years', '₹25,000 - ₹45,000/month', 'Write compelling copy for advertisements, marketing campaigns, and promotional materials. Create content that drives conversions.', '2+ years copywriting experience, Marketing knowledge, Creative thinking, Portfolio required', 'Competitive salary, Creative projects, Flexible hours, Health insurance', ARRAY['Copywriting', 'Marketing', 'Creative Writing', 'Advertising'], 'Content Writing', false, 0, 80, 54, 9),
    
    -- Virtual Assistant Jobs
    ('Virtual Assistant', 'Remote (India)', 'part-time', 'fresher', '₹12,000 - ₹22,000/month', 'Provide administrative support including email management, scheduling, research, and basic bookkeeping tasks.', 'Good organizational skills, Professional communication, Basic computer skills, Time management', 'Flexible schedule, Skill development, Work-life balance, Growth opportunities', ARRAY['Virtual Assistant', 'Administration', 'Organization', 'Communication'], 'Virtual Assistant', false, 0, 70, 38, 6),
    ('Executive Assistant (Remote)', 'Remote (India)', 'full-time', '3-5 years', '₹30,000 - ₹50,000/month', 'Support senior executives with complex administrative tasks, project coordination, and stakeholder communication.', '3+ years executive support experience, Advanced MS Office skills, Excellent communication, Discretion and professionalism', 'Premium health insurance, Professional development, Flexible working, Performance bonuses', ARRAY['Executive Support', 'Project Management', 'Communication', 'MS Office'], 'Virtual Assistant', true, 2, 110, 89, 18),
    
    -- Digital Marketing Jobs
    ('Digital Marketing Executive', 'Remote (India)', 'full-time', '1-3 years', '₹22,000 - ₹38,000/month', 'Manage social media campaigns, create marketing content, analyze performance metrics, and optimize digital strategies.', '1+ years digital marketing experience, Social media expertise, Google Ads knowledge, Analytics skills', 'Creative environment, Learning budget, Flexible hours, Performance incentives', ARRAY['Digital Marketing', 'Social Media', 'Google Ads', 'Analytics'], 'Digital Marketing', true, 1, 100, 72, 14),
    ('SEO Specialist', 'Remote (India)', 'full-time', '2-4 years', '₹25,000 - ₹45,000/month', 'Optimize websites for search engines, conduct keyword research, analyze SEO performance, and implement improvement strategies.', '2+ years SEO experience, Technical SEO knowledge, Google Analytics, Content optimization skills', 'Skill enhancement programs, Results-based bonuses, Workly India setup allowance, Health benefits', ARRAY['SEO', 'Google Analytics', 'Keyword Research', 'Technical SEO'], 'Digital Marketing', false, 0, 85, 61, 11),
    
    -- Software Development Jobs
    ('Junior Web Developer', 'Remote (India)', 'full-time', '1-3 years', '₹30,000 - ₹55,000/month', 'Develop and maintain websites using modern technologies. Work on both frontend and backend development projects.', '1+ years web development experience, HTML/CSS/JavaScript, React or Angular, Basic backend knowledge', 'Latest technology exposure, Mentorship program, Flexible schedule, Health insurance', ARRAY['Web Development', 'JavaScript', 'React', 'HTML/CSS'], 'Software Development', true, 2, 130, 95, 22),
    ('Python Developer', 'Remote (India)', 'full-time', '2-4 years', '₹40,000 - ₹70,000/month', 'Develop Python applications, work with databases, create APIs, and collaborate with cross-functional teams.', '2+ years Python experience, Django/Flask framework, Database knowledge, API development', 'Competitive salary, Latest tools, Learning opportunities, Work-life balance', ARRAY['Python', 'Django', 'API Development', 'Database'], 'Software Development', false, 0, 95, 56, 13),
    
    -- Additional diverse jobs
    ('Graphic Designer', 'Remote (India)', 'full-time', '1-3 years', '₹18,000 - ₹35,000/month', 'Create visual content for websites, social media, marketing materials, and brand identity. Work with clients to understand design requirements.', '1+ years graphic design experience, Proficiency in Adobe Creative Suite, Strong portfolio, Creative thinking', 'Creative projects, Flexible schedule, Professional software licenses, Health insurance', ARRAY['Graphic Design', 'Adobe Photoshop', 'Adobe Illustrator', 'Creativity'], 'Design', false, 0, 88, 43, 7),
    ('Social Media Manager', 'Remote (India)', 'full-time', '2-4 years', '₹25,000 - ₹42,000/month', 'Manage social media accounts, create content strategies, engage with audiences, and analyze social media performance.', '2+ years social media experience, Content creation skills, Analytics knowledge, Understanding of social platforms', 'Creative freedom, Latest tools, Performance bonuses, Flexible working hours', ARRAY['Social Media', 'Content Creation', 'Analytics', 'Strategy'], 'Digital Marketing', false, 0, 92, 58, 10),
    ('Online Tutor', 'Remote (India)', 'part-time', 'fresher', '₹15,000 - ₹30,000/month', 'Teach students online through video calls, create lesson plans, and help students achieve their academic goals.', 'Subject expertise, Good communication skills, Teaching experience preferred, Reliable internet connection', 'Flexible schedule, Work-life balance, Opportunity to make a difference, Performance incentives', ARRAY['Teaching', 'Communication', 'Subject Knowledge', 'Online Tools'], 'Education', false, 0, 76, 41, 6)
) AS job_data (title, location, job_type, experience_level, salary_range, description, requirements, benefits, skills, category, is_boosted, boost_level, trending_score, views_count, applications_count)
LIMIT 8; -- Add 8 jobs per existing company

-- Add some recent job postings with timestamps spread over the last few days
INSERT INTO jobs (company_id, title, location, job_type, experience_level, salary_range, description, requirements, benefits, skills, category, status, is_boosted, boost_level, trending_score, views_count, applications_count, created_at) 
SELECT 
  c.id,
  'Remote Chat Support Agent',
  'Workly India',
  'full-time',
  'fresher',
  '₹16,000 - ₹24,000/month',
  'Provide customer support through live chat, resolve customer issues, and maintain high satisfaction ratings. Perfect for freshers looking to start their remote career.',
  'Good typing speed, Excellent English communication, Customer service mindset, Ability to multitask',
  'Comprehensive training, Health insurance, Flexible shifts, Performance bonuses, Career growth',
  ARRAY['Customer Support', 'Chat Support', 'Communication', 'English'],
  'Customer Support',
  'active',
  true,
  1,
  95,
  23,
  3,
  NOW() - INTERVAL '2 hours'
FROM companies c 
WHERE c.company_name = 'Workly India 5'
LIMIT 1;

-- Update trending scores for all jobs to make them look more active
UPDATE jobs 
SET trending_score = CASE 
  WHEN is_boosted = true THEN trending_score + boost_level * 50
  ELSE trending_score + (views_count * 2) + (applications_count * 5)
END
WHERE status = 'active';