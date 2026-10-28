-- Create auto notification triggers and improved search functions

-- 1. Create function for fuzzy search with typo tolerance
CREATE OR REPLACE FUNCTION public.fuzzy_search_jobs(
  search_query text DEFAULT '',
  job_location text DEFAULT '',
  job_type_filter text DEFAULT '',
  experience_filter text DEFAULT '',
  salary_min integer DEFAULT 0,
  salary_max integer DEFAULT 1000000,
  category_filter text DEFAULT '',
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
) RETURNS TABLE(
  id uuid,
  title text,
  company_name text,
  location text,
  job_type text,
  experience_level text,
  salary_range text,
  description text,
  requirements text,
  benefits text,
  skills text[],
  status text,
  category text,
  created_at timestamp with time zone,
  trending_score numeric,
  views_count integer,
  applications_count integer,
  calls_count integer,
  shares_count integer,
  is_boosted boolean,
  boost_level integer,
  logo_url text,
  match_score integer
)
LANGUAGE plpgsql
AS $function$
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
        c.logo_url,
        -- Calculate match score for fuzzy search
        (
          CASE 
            -- Exact matches get highest score
            WHEN search_query = '' THEN 100
            WHEN LOWER(j.title) LIKE LOWER('%' || search_query || '%') THEN 95
            WHEN LOWER(COALESCE(c.company_name, '')) LIKE LOWER('%' || search_query || '%') THEN 90
            -- Similarity matching for typos
            WHEN similarity(LOWER(j.title), LOWER(search_query)) > 0.3 THEN 85
            WHEN similarity(LOWER(COALESCE(c.company_name, '')), LOWER(search_query)) > 0.3 THEN 80
            -- Skills matching
            WHEN EXISTS (
              SELECT 1 FROM unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) AS skill 
              WHERE similarity(LOWER(skill), LOWER(search_query)) > 0.4
            ) THEN 75
            -- Category matching
            WHEN similarity(LOWER(j.category), LOWER(search_query)) > 0.3 THEN 70
            -- Description matching
            WHEN j.description ILIKE '%' || search_query || '%' THEN 65
            ELSE 0
          END
        )::integer AS match_score
    FROM public.jobs j
    LEFT JOIN public.companies c ON j.company_id = c.id
    WHERE j.status = 'active'
        AND (
          search_query = '' OR (
            -- Enhanced search with fuzzy matching
            j.title ILIKE '%' || search_query || '%' OR
            COALESCE(c.company_name, '') ILIKE '%' || search_query || '%' OR
            j.description ILIKE '%' || search_query || '%' OR
            j.category ILIKE '%' || search_query || '%' OR
            similarity(LOWER(j.title), LOWER(search_query)) > 0.3 OR
            similarity(LOWER(COALESCE(c.company_name, '')), LOWER(search_query)) > 0.3 OR
            similarity(LOWER(j.category), LOWER(search_query)) > 0.3 OR
            EXISTS (
              SELECT 1 FROM unnest(COALESCE(j.skills, ARRAY[]::TEXT[])) AS skill 
              WHERE skill ILIKE '%' || search_query || '%' OR similarity(LOWER(skill), LOWER(search_query)) > 0.4
            )
          )
        )
        AND (job_location = '' OR j.location ILIKE '%' || job_location || '%')
        AND (job_type_filter = '' OR j.job_type = job_type_filter)
        AND (experience_filter = '' OR j.experience_level = experience_filter)
        AND (category_filter = '' OR j.category = category_filter)
    ORDER BY 
        j.is_boosted DESC,
        match_score DESC,
        j.trending_score DESC,
        j.created_at DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$function$;

-- 2. Create notification trigger functions
CREATE OR REPLACE FUNCTION public.create_job_application_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    job_title TEXT;
    company_name TEXT;
    employer_id UUID;
BEGIN
    -- Get job and company details
    SELECT j.title, c.company_name, c.user_id 
    INTO job_title, company_name, employer_id
    FROM public.jobs j
    LEFT JOIN public.companies c ON j.company_id = c.id
    WHERE j.id = NEW.job_id;
    
    -- Create notification for employer
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        employer_id,
        'New Job Application',
        'Someone applied for your ' || job_title || ' position',
        'application',
        '/job/' || NEW.job_id || '/applicants',
        jsonb_build_object(
            'job_id', NEW.job_id,
            'application_id', NEW.id,
            'applicant_id', NEW.user_id
        )
    );
    
    RETURN NEW;
END;
$function$;

-- 3. Create new job notification trigger
CREATE OR REPLACE FUNCTION public.create_new_job_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    user_record RECORD;
BEGIN
    -- Notify users based on their profile preferences
    FOR user_record IN 
        SELECT DISTINCT p.user_id
        FROM public.profiles p
        WHERE p.is_profile_complete = true
        AND (
            -- Match job type preference
            (p.job_type IS NULL OR p.job_type = NEW.job_type)
            -- Match location preference  
            OR (p.preferred_location IS NULL OR NEW.location ILIKE '%' || p.preferred_location || '%')
            -- Match skills
            OR (p.skills IS NOT NULL AND COALESCE(NEW.skills, ARRAY[]::TEXT[]) && p.skills)
            -- Match industry
            OR (p.industry IS NULL OR p.industry = NEW.category)
        )
        LIMIT 100 -- Limit to prevent too many notifications
    LOOP
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            action_url,
            metadata
        ) VALUES (
            user_record.user_id,
            'New Job Match Found',
            'A new ' || NEW.title || ' position matches your profile',
            'job_alert',
            '/job/' || NEW.id,
            jsonb_build_object(
                'job_id', NEW.id,
                'job_title', NEW.title,
                'match_type', 'profile_match'
            )
        );
    END LOOP;
    
    RETURN NEW;
END;
$function$;

-- 4. Create job status update notification
CREATE OR REPLACE FUNCTION public.create_application_status_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    job_title TEXT;
    status_message TEXT;
BEGIN
    -- Only create notification if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Get job title
    SELECT j.title INTO job_title
    FROM public.jobs j
    WHERE j.id = NEW.job_id;
    
    -- Create appropriate message based on status
    CASE NEW.status
        WHEN 'shortlisted' THEN
            status_message := 'Congratulations! You have been shortlisted for ' || job_title;
        WHEN 'interview_scheduled' THEN
            status_message := 'Interview scheduled for ' || job_title || ' position';
        WHEN 'rejected' THEN
            status_message := 'Application status updated for ' || job_title;
        WHEN 'hired' THEN
            status_message := 'Congratulations! You have been selected for ' || job_title;
        ELSE
            status_message := 'Application status updated for ' || job_title;
    END CASE;
    
    -- Create notification for applicant
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        metadata
    ) VALUES (
        NEW.user_id,
        'Application Status Update',
        status_message,
        'application',
        '/job/' || NEW.job_id,
        jsonb_build_object(
            'job_id', NEW.job_id,
            'application_id', NEW.id,
            'old_status', OLD.status,
            'new_status', NEW.status
        )
    );
    
    RETURN NEW;
END;
$function$;

-- Create triggers
DROP TRIGGER IF EXISTS notify_job_application ON public.job_applications;
CREATE TRIGGER notify_job_application
    AFTER INSERT ON public.job_applications
    FOR EACH ROW EXECUTE FUNCTION public.create_job_application_notification();

DROP TRIGGER IF EXISTS notify_new_job ON public.jobs;  
CREATE TRIGGER notify_new_job
    AFTER INSERT ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.create_new_job_notifications();

DROP TRIGGER IF EXISTS notify_application_status ON public.job_applications;
CREATE TRIGGER notify_application_status
    AFTER UPDATE ON public.job_applications
    FOR EACH ROW EXECUTE FUNCTION public.create_application_status_notification();

-- Enable pg_trgm extension for similarity functions
CREATE EXTENSION IF NOT EXISTS pg_trgm;