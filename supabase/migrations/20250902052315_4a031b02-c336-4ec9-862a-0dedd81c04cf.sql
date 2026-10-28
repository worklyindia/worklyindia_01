-- Phase 1: Fix database schema issues and add missing functionality

-- First, let's create sample job data with proper UUIDs to replace the hardcoded mock data
INSERT INTO public.companies (id, user_id, company_name, industry, company_size, location, website, description, is_profile_complete)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440100', 'TechCorp Solutions', 'Technology', '100-500', 'Remote (India)', 'https://techcorp.com', 'Leading technology solutions provider specializing in customer support services', true),
  ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440101', 'Digital Marketing Pro', 'Marketing', '50-100', 'Workly India', 'https://digitalmarketingpro.com', 'Digital marketing agency helping businesses grow online', true),
  ('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440102', 'Global Business Hub', 'Business Services', '200-1000', 'Remote', 'https://globalbusinesshub.com', 'Global business process outsourcing company', true),
  ('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440103', 'Creative Media House', 'Media', '20-50', 'Workly India', 'https://creativemediahouse.com', 'Creative media production company', true),
  ('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440104', 'Photography Studio Pro', 'Photography', '10-50', 'Remote, India', 'https://photographystudiopro.com', 'Professional photography and editing services', true),
  ('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440105', 'Brand Design Agency', 'Design', '30-100', 'Workly India', 'https://branddesignagency.com', 'Brand design and creative agency', true),
  ('550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440106', 'Digital Animation Studio', 'Animation', '50-200', 'Remote, India', 'https://digitalanimationstudio.com', 'Digital animation and motion graphics studio', true)
ON CONFLICT (id) DO NOTHING;

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
ON CONFLICT (id) DO NOTHING;

-- Create comprehensive search function
CREATE OR REPLACE FUNCTION public.search_jobs(
    search_query TEXT DEFAULT '',
    job_location TEXT DEFAULT '',
    job_type_filter TEXT DEFAULT '',
    experience_filter TEXT DEFAULT '',
    salary_min INTEGER DEFAULT 0,
    salary_max INTEGER DEFAULT 1000000,
    category_filter TEXT DEFAULT '',
    page_size INTEGER DEFAULT 20,
    page_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    title TEXT,
    company_name TEXT,
    location TEXT,
    job_type TEXT,
    experience_level TEXT,
    salary_range TEXT,
    description TEXT,
    requirements TEXT,
    benefits TEXT,
    skills TEXT[],
    status TEXT,
    category TEXT,
    created_at TIMESTAMPTZ,
    trending_score NUMERIC,
    views_count INTEGER,
    applications_count INTEGER,
    calls_count INTEGER,
    shares_count INTEGER,
    is_boosted BOOLEAN,
    boost_level INTEGER,
    logo_url TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id,
        j.title,
        c.company_name,
        j.location,
        j.job_type,
        j.experience_level,
        j.salary_range,
        j.description,
        j.requirements,
        j.benefits,
        j.skills,
        j.status,
        j.category,
        j.created_at,
        j.trending_score,
        j.views_count,
        j.applications_count,
        j.calls_count,
        j.shares_count,
        j.is_boosted,
        j.boost_level,
        c.logo_url
    FROM public.jobs j
    JOIN public.companies c ON j.company_id = c.id
    WHERE j.status = 'active'
        AND (search_query = '' OR (
            j.title ILIKE '%' || search_query || '%' OR
            c.company_name ILIKE '%' || search_query || '%' OR
            j.description ILIKE '%' || search_query || '%' OR
            j.category ILIKE '%' || search_query || '%' OR
            EXISTS (SELECT 1 FROM unnest(j.skills) AS skill WHERE skill ILIKE '%' || search_query || '%')
        ))
        AND (job_location = '' OR j.location ILIKE '%' || job_location || '%')
        AND (job_type_filter = '' OR j.job_type = job_type_filter)
        AND (experience_filter = '' OR j.experience_level = experience_filter)
        AND (category_filter = '' OR j.category = category_filter)
    ORDER BY 
        j.is_boosted DESC,
        j.trending_score DESC,
        j.created_at DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$;

-- Create search suggestions function
CREATE OR REPLACE FUNCTION public.get_search_suggestions(
    query_text TEXT,
    limit_count INTEGER DEFAULT 10
) RETURNS TABLE (
    suggestion TEXT,
    type TEXT,
    count INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH job_titles AS (
        SELECT DISTINCT j.title as suggestion, 'job_title' as type, COUNT(*)::INTEGER as count
        FROM public.jobs j
        WHERE j.status = 'active' AND j.title ILIKE '%' || query_text || '%'
        GROUP BY j.title
    ),
    companies AS (
        SELECT DISTINCT c.company_name as suggestion, 'company' as type, COUNT(*)::INTEGER as count
        FROM public.companies c
        JOIN public.jobs j ON j.company_id = c.id
        WHERE j.status = 'active' AND c.company_name ILIKE '%' || query_text || '%'
        GROUP BY c.company_name
    ),
    skills AS (
        SELECT DISTINCT skill as suggestion, 'skill' as type, COUNT(*)::INTEGER as count
        FROM public.jobs j, unnest(j.skills) as skill
        WHERE j.status = 'active' AND skill ILIKE '%' || query_text || '%'
        GROUP BY skill
    ),
    categories AS (
        SELECT DISTINCT j.category as suggestion, 'category' as type, COUNT(*)::INTEGER as count
        FROM public.jobs j
        WHERE j.status = 'active' AND j.category ILIKE '%' || query_text || '%'
        GROUP BY j.category
    )
    SELECT * FROM job_titles
    UNION ALL
    SELECT * FROM companies
    UNION ALL
    SELECT * FROM skills
    UNION ALL
    SELECT * FROM categories
    ORDER BY count DESC, suggestion
    LIMIT limit_count;
END;
$$;

-- Create favorites table
CREATE TABLE IF NOT EXISTS public.job_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    job_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

ALTER TABLE public.job_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites" ON public.job_favorites
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

-- Create search history table
CREATE TABLE IF NOT EXISTS public.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    search_query TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own search history" ON public.search_history
FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can create search history" ON public.search_history
FOR INSERT WITH CHECK (true);

-- Function to get job statistics for categories
CREATE OR REPLACE FUNCTION public.get_job_categories_stats()
RETURNS TABLE (
    category TEXT,
    job_count BIGINT,
    growth_percentage INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.category,
        COUNT(*) as job_count,
        -- Calculate growth based on jobs posted in last 30 days vs previous 30 days
        (
            CASE 
                WHEN COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '60 days' AND j.created_at < NOW() - INTERVAL '30 days' THEN 1 END) = 0 
                THEN 100
                ELSE (
                    (COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::FLOAT / 
                     NULLIF(COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '60 days' AND j.created_at < NOW() - INTERVAL '30 days' THEN 1 END), 0) - 1) * 100
                )::INTEGER
            END
        ) as growth_percentage
    FROM public.jobs j
    WHERE j.status = 'active'
    GROUP BY j.category
    ORDER BY job_count DESC;
END;
$$;