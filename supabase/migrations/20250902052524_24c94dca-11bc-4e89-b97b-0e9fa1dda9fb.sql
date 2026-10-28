-- Create search function without sample data that depends on non-existent users
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
        COALESCE(c.company_name, 'Company') as company_name,
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
    LEFT JOIN public.companies c ON j.company_id = c.id
    WHERE j.status = 'active'
        AND (search_query = '' OR (
            j.title ILIKE '%' || search_query || '%' OR
            COALESCE(c.company_name, '') ILIKE '%' || search_query || '%' OR
            j.description ILIKE '%' || search_query || '%' OR
            j.category ILIKE '%' || search_query || '%' OR
            EXISTS (SELECT 1 FROM unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) AS skill WHERE skill ILIKE '%' || search_query || '%')
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
        FROM public.jobs j, unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) as skill
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
    HAVING COUNT(*) > 0
    ORDER BY job_count DESC;
END;
$$;

-- Function to get unread notifications count
CREATE OR REPLACE FUNCTION public.get_unread_notifications_count(user_uuid UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    notification_count INTEGER;
    target_user_id UUID;
BEGIN
    target_user_id := COALESCE(user_uuid, auth.uid());
    
    IF target_user_id IS NULL THEN
        RETURN 0;
    END IF;
    
    SELECT COUNT(*)::INTEGER INTO notification_count
    FROM public.notifications
    WHERE user_id = target_user_id AND is_read = FALSE;
    
    RETURN COALESCE(notification_count, 0);
END;
$$;