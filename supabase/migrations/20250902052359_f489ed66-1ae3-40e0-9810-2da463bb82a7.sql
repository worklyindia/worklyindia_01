-- Create sample job data with realistic UUIDs that don't require actual users
-- Insert companies without user_id foreign key constraint issues
INSERT INTO public.companies (id, user_id, company_name, industry, company_size, location, website, description, is_profile_complete)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', '00000000-0000-0000-0000-000000000001', 'TechCorp Solutions', 'Technology', '100-500', 'Remote (India)', 'https://techcorp.com', 'Leading technology solutions provider specializing in customer support services', true),
  ('550e8400-e29b-41d4-a716-446655440002', '00000000-0000-0000-0000-000000000002', 'Digital Marketing Pro', 'Marketing', '50-100', 'Workly India', 'https://digitalmarketingpro.com', 'Digital marketing agency helping businesses grow online', true),
  ('550e8400-e29b-41d4-a716-446655440003', '00000000-0000-0000-0000-000000000003', 'Global Business Hub', 'Business Services', '200-1000', 'Remote', 'https://globalbusinesshub.com', 'Global business process outsourcing company', true),
  ('550e8400-e29b-41d4-a716-446655440004', '00000000-0000-0000-0000-000000000004', 'Creative Media House', 'Media', '20-50', 'Workly India', 'https://creativemediahouse.com', 'Creative media production company', true),
  ('550e8400-e29b-41d4-a716-446655440005', '00000000-0000-0000-0000-000000000005', 'Photography Studio Pro', 'Photography', '10-50', 'Remote, India', 'https://photographystudiopro.com', 'Professional photography and editing services', true),
  ('550e8400-e29b-41d4-a716-446655440006', '00000000-0000-0000-0000-000000000006', 'Brand Design Agency', 'Design', '30-100', 'Workly India', 'https://branddesignagency.com', 'Brand design and creative agency', true),
  ('550e8400-e29b-41d4-a716-446655440007', '00000000-0000-0000-0000-000000000007', 'Digital Animation Studio', 'Animation', '50-200', 'Remote, India', 'https://digitalanimationstudio.com', 'Digital animation and motion graphics studio', true)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  industry = EXCLUDED.industry,
  company_size = EXCLUDED.company_size,
  location = EXCLUDED.location,
  website = EXCLUDED.website,
  description = EXCLUDED.description,
  is_profile_complete = EXCLUDED.is_profile_complete;

-- Insert sample jobs with proper UUIDs
INSERT INTO public.jobs (id, company_id, title, location, job_type, experience_level, salary_range, description, requirements, benefits, skills, status, category, created_at, trending_score, views_count, applications_count, calls_count, shares_count)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440001', 'Customer Support Executive', 'Remote (India)', 'Full-time', '1-3 years', '₹25,000 - ₹35,000', 'Handle customer inquiries via phone, email, and chat. Provide technical support and resolve customer issues promptly. Excellent communication skills required.', 'Excellent communication skills, Customer service experience, Technical aptitude', 'Health insurance, Workly India, Flexible hours', '{"Customer Support", "Communication", "Remote"}', 'active', 'Customer Support', NOW() - INTERVAL '2 hours', 75, 150, 25, 5, 8),
  
  ('550e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440002', 'Content Writer', 'Workly India', 'Part-time', '0-2 years', '₹20,000 - ₹30,000', 'Create engaging content for blogs, websites, and social media. Research topics and write SEO-optimized articles. Creative writing skills preferred.', 'Strong writing skills, SEO knowledge, Research abilities', 'Flexible schedule, Performance bonuses, Career growth', '{"Content Writing", "SEO", "Creative Writing"}', 'active', 'Content Writing', NOW() - INTERVAL '4 hours', 85, 120, 18, 3, 6),
  
  ('550e8400-e29b-41d4-a716-446655440203', '550e8400-e29b-41d4-a716-446655440003', 'Virtual Assistant', 'Remote', 'Full-time', '0-1 years', '₹18,000 - ₹25,000', 'Provide administrative support including email management, scheduling, and data entry. Strong organizational skills and attention to detail required.', 'Organizational skills, Email management, Data entry', 'Workly India, Training provided, Growth opportunities', '{"Virtual Assistant", "Admin Support", "Organization"}', 'active', 'Virtual Assistant', NOW() - INTERVAL '6 hours', 90, 200, 35, 8, 12),
  
  ('550e8400-e29b-41d4-a716-446655440204', '550e8400-e29b-41d4-a716-446655440004', 'Video Editor', 'Workly India', 'Full-time', '1-3 years', '₹25,000 - ₹45,000', 'Edit videos for YouTube, social media, and marketing campaigns. Proficiency in Adobe Premiere Pro, Final Cut Pro required.', 'Video editing experience, Adobe Premiere Pro, Final Cut Pro', 'Creative environment, Latest software, Performance bonuses', '{"Video Editing", "Adobe Premiere", "Remote"}', 'active', 'Video Editing', NOW() - INTERVAL '1 hour', 120, 180, 22, 4, 9),
  
  ('550e8400-e29b-41d4-a716-446655440205', '550e8400-e29b-41d4-a716-446655440005', 'Photo Editor / Retoucher', 'Remote, India', 'Full-time', '1-4 years', '₹20,000 - ₹35,000', 'Professional photo editing and retouching for portrait, wedding, and commercial photography. Photoshop expert needed.', 'Adobe Photoshop expertise, Photo retouching experience, Attention to detail', 'Creative projects, Flexible hours, Skill development', '{"Photo Editing", "Photoshop", "Retouching"}', 'active', 'Photo Editing', NOW() - INTERVAL '30 minutes', 95, 160, 28, 6, 7),
  
  ('550e8400-e29b-41d4-a716-446655440206', '550e8400-e29b-41d4-a716-446655440006', 'Logo Designer', 'Workly India', 'Full-time', '0-3 years', '₹18,000 - ₹30,000', 'Create unique logo designs for businesses and startups. Knowledge of Illustrator, CorelDraw required.', 'Logo design portfolio, Adobe Illustrator, CorelDraw', 'Creative freedom, Client interaction, Portfolio building', '{"Logo Design", "Illustrator", "Branding"}', 'active', 'Logo Design', NOW() - INTERVAL '3 hours', 70, 140, 20, 2, 5),
  
  ('550e8400-e29b-41d4-a716-446655440207', '550e8400-e29b-41d4-a716-446655440007', 'Motion Graphics Designer', 'Remote, India', 'Full-time', '2-5 years', '₹30,000 - ₹50,000', 'Create animated graphics for videos, presentations, and digital content. After Effects and Cinema 4D experience preferred.', 'Motion graphics portfolio, After Effects, Cinema 4D', 'Cutting-edge projects, Remote collaboration, Competitive salary', '{"Motion Graphics", "After Effects", "Animation"}', 'active', 'Motion Graphics', NOW() - INTERVAL '45 minutes', 130, 190, 30, 7, 10)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  location = EXCLUDED.location,
  job_type = EXCLUDED.job_type,
  experience_level = EXCLUDED.experience_level,
  salary_range = EXCLUDED.salary_range,
  description = EXCLUDED.description,
  requirements = EXCLUDED.requirements,
  benefits = EXCLUDED.benefits,
  skills = EXCLUDED.skills,
  category = EXCLUDED.category,
  trending_score = EXCLUDED.trending_score,
  views_count = EXCLUDED.views_count,
  applications_count = EXCLUDED.applications_count,
  calls_count = EXCLUDED.calls_count,
  shares_count = EXCLUDED.shares_count;