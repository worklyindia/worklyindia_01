-- Create job_images table for storing multiple images per job
CREATE TABLE public.job_images (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type TEXT NOT NULL DEFAULT 'uploaded' CHECK (image_type IN ('uploaded', 'ai_generated')),
    size_category TEXT NOT NULL DEFAULT 'banner' CHECK (size_category IN ('banner', 'square', 'social')),
    width INTEGER,
    height INTEGER,
    file_size_bytes INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_image_usage table for tracking AI image generation limits
CREATE TABLE public.ai_image_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_plan TEXT NOT NULL DEFAULT 'free',
    month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
    images_generated INTEGER NOT NULL DEFAULT 0,
    monthly_limit INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, month_year)
);

-- Create indexes for performance
CREATE INDEX idx_job_images_job_id ON public.job_images(job_id);
CREATE INDEX idx_job_images_user_id ON public.job_images(user_id);
CREATE INDEX idx_job_images_sort_order ON public.job_images(job_id, sort_order);
CREATE INDEX idx_ai_image_usage_user_month ON public.ai_image_usage(user_id, month_year);

-- Enable RLS
ALTER TABLE public.job_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_image_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_images
-- Anyone can view job images for active jobs
CREATE POLICY "Anyone can view job images" 
ON public.job_images 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.jobs 
        WHERE jobs.id = job_images.job_id 
        AND jobs.status = 'active'
    )
);

-- Users can manage their own job images
CREATE POLICY "Users can insert their own job images" 
ON public.job_images 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job images" 
ON public.job_images 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job images" 
ON public.job_images 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for ai_image_usage
CREATE POLICY "Users can view their own AI usage" 
ON public.ai_image_usage 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI usage" 
ON public.ai_image_usage 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI usage" 
ON public.ai_image_usage 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Admin policy for ai_image_usage (for owner portal)
CREATE POLICY "Admins can view all AI usage" 
ON public.ai_image_usage 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE admin_users.user_id = auth.uid()
    )
);

-- Create storage bucket for job images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'job-images', 
    'job-images', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for job-images bucket
CREATE POLICY "Job images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'job-images');

CREATE POLICY "Authenticated users can upload job images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'job-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own job images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'job-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own job images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'job-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to check AI image generation limits
CREATE OR REPLACE FUNCTION public.check_ai_image_limit(p_user_id UUID)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, monthly_limit INTEGER, plan_name TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_month TEXT;
    v_plan_name TEXT;
    v_limit INTEGER;
    v_used INTEGER;
BEGIN
    v_current_month := to_char(now(), 'YYYY-MM');
    
    -- Get user's subscription plan
    SELECT COALESCE(
        (SELECT acp.name FROM ai_chat_subscriptions acs
         JOIN ai_chat_plans acp ON acs.plan_id = acp.id
         WHERE acs.user_id = p_user_id 
         AND acs.status = 'active' 
         AND acs.ends_at > now()
         ORDER BY acp.price_inr DESC
         LIMIT 1),
        'Free'
    ) INTO v_plan_name;
    
    -- Set limit based on plan
    CASE v_plan_name
        WHEN 'Enterprise' THEN v_limit := 100;
        WHEN 'Pro' THEN v_limit := 100;
        WHEN 'Basic' THEN v_limit := 20;
        ELSE v_limit := 5;
    END CASE;
    
    -- Get current usage
    SELECT COALESCE(images_generated, 0) INTO v_used
    FROM ai_image_usage
    WHERE user_id = p_user_id AND month_year = v_current_month;
    
    IF v_used IS NULL THEN
        v_used := 0;
    END IF;
    
    RETURN QUERY SELECT 
        (v_used < v_limit) AS allowed,
        (v_limit - v_used) AS remaining,
        v_limit AS monthly_limit,
        v_plan_name AS plan_name;
END;
$$;

-- Function to increment AI image usage
CREATE OR REPLACE FUNCTION public.increment_ai_image_usage(p_user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_month TEXT;
    v_plan_name TEXT;
    v_limit INTEGER;
BEGIN
    v_current_month := to_char(now(), 'YYYY-MM');
    
    -- Get user's plan and limit
    SELECT COALESCE(
        (SELECT acp.name FROM ai_chat_subscriptions acs
         JOIN ai_chat_plans acp ON acs.plan_id = acp.id
         WHERE acs.user_id = p_user_id 
         AND acs.status = 'active' 
         AND acs.ends_at > now()
         ORDER BY acp.price_inr DESC
         LIMIT 1),
        'Free'
    ) INTO v_plan_name;
    
    CASE v_plan_name
        WHEN 'Enterprise' THEN v_limit := 100;
        WHEN 'Pro' THEN v_limit := 100;
        WHEN 'Basic' THEN v_limit := 20;
        ELSE v_limit := 5;
    END CASE;
    
    -- Insert or update usage
    INSERT INTO ai_image_usage (user_id, month_year, images_generated, monthly_limit, subscription_plan)
    VALUES (p_user_id, v_current_month, 1, v_limit, v_plan_name)
    ON CONFLICT (user_id, month_year) 
    DO UPDATE SET 
        images_generated = ai_image_usage.images_generated + 1,
        monthly_limit = v_limit,
        subscription_plan = v_plan_name,
        updated_at = now();
    
    RETURN TRUE;
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_job_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_job_images_updated_at
BEFORE UPDATE ON public.job_images
FOR EACH ROW
EXECUTE FUNCTION public.update_job_images_updated_at();

CREATE TRIGGER update_ai_image_usage_updated_at
BEFORE UPDATE ON public.ai_image_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_job_images_updated_at();