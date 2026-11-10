-- Add FIFO processing enhancements to google_indexing_queue
-- Add columns if not exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_indexing_queue' AND column_name = 'attempt_number') THEN
        ALTER TABLE public.google_indexing_queue ADD COLUMN attempt_number integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_indexing_queue' AND column_name = 'first_attempt_at') THEN
        ALTER TABLE public.google_indexing_queue ADD COLUMN first_attempt_at timestamp with time zone;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_indexing_queue' AND column_name = 'last_attempt_at') THEN
        ALTER TABLE public.google_indexing_queue ADD COLUMN last_attempt_at timestamp with time zone;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_indexing_queue' AND column_name = 'processing_method') THEN
        ALTER TABLE public.google_indexing_queue ADD COLUMN processing_method text DEFAULT 'immediate';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'google_indexing_queue' AND column_name = 'estimated_process_date') THEN
        ALTER TABLE public.google_indexing_queue ADD COLUMN estimated_process_date date;
    END IF;
END $$;

-- Create a function to auto-assign queue_position in FIFO order
CREATE OR REPLACE FUNCTION public.assign_queue_position()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign if queue_position is null
    IF NEW.queue_position IS NULL THEN
        SELECT COALESCE(MAX(queue_position), 0) + 1 INTO NEW.queue_position
        FROM public.google_indexing_queue;
    END IF;
    
    -- Set first_attempt_at if not set
    IF NEW.first_attempt_at IS NULL AND NEW.status = 'pending' THEN
        NEW.first_attempt_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS assign_queue_position_trigger ON public.google_indexing_queue;
CREATE TRIGGER assign_queue_position_trigger
    BEFORE INSERT ON public.google_indexing_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_queue_position();

-- Create function to reset daily quota at 1:30 PM IST (8:00 AM UTC)
CREATE OR REPLACE FUNCTION public.reset_daily_indexing_quota()
RETURNS void AS $$
DECLARE
    today_date date;
BEGIN
    today_date := CURRENT_DATE;
    
    -- Insert or update quota record for today
    INSERT INTO public.indexing_daily_quota (date, quota_used, quota_limit, last_reset_at)
    VALUES (today_date, 0, 200, NOW())
    ON CONFLICT (date) 
    DO UPDATE SET quota_used = 0, last_reset_at = NOW(), updated_at = NOW();
    
    -- Log the reset
    INSERT INTO public.function_logs (function_name, status, response_data)
    VALUES ('reset_daily_indexing_quota', 'success', 
            jsonb_build_object('date', today_date, 'reset_at', NOW(), 'timezone', 'IST'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment quota usage
CREATE OR REPLACE FUNCTION public.increment_quota_usage(increment_by integer DEFAULT 1)
RETURNS void AS $$
DECLARE
    today_date date;
BEGIN
    today_date := CURRENT_DATE;
    
    INSERT INTO public.indexing_daily_quota (date, quota_used, quota_limit)
    VALUES (today_date, increment_by, 200)
    ON CONFLICT (date) 
    DO UPDATE SET quota_used = indexing_daily_quota.quota_used + increment_by, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get estimated completion date for pending queue
CREATE OR REPLACE FUNCTION public.get_queue_completion_estimate()
RETURNS TABLE (
    pending_count bigint,
    days_to_complete integer,
    estimated_completion_date date
) AS $$
DECLARE
    daily_limit integer := 180; -- Effective limit after buffer
BEGIN
    SELECT COUNT(*) INTO pending_count
    FROM public.google_indexing_queue
    WHERE status = 'pending' AND retry_count < 5;
    
    days_to_complete := CEIL(pending_count::numeric / daily_limit);
    estimated_completion_date := CURRENT_DATE + days_to_complete;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster FIFO queries
CREATE INDEX IF NOT EXISTS idx_queue_fifo_order 
    ON public.google_indexing_queue (status, queue_position ASC, created_at ASC) 
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_queue_scheduled 
    ON public.google_indexing_queue (scheduled_for) 
    WHERE status = 'pending' AND scheduled_for IS NOT NULL;

-- Add comment for documentation
COMMENT ON FUNCTION public.reset_daily_indexing_quota IS 
    'Resets daily Google indexing quota. Should be called at 1:30 PM IST (8:00 AM UTC) when Google Search Console quota resets (12:00 AM PST).';