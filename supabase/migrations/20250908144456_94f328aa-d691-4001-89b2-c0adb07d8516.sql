-- Create cleanup log table first
CREATE TABLE IF NOT EXISTS public.interview_cleanup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interviews_deleted INTEGER NOT NULL DEFAULT 0,
    expired_deleted INTEGER NOT NULL DEFAULT 0,
    cancelled_deleted INTEGER NOT NULL DEFAULT 0,
    cleanup_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on cleanup logs
ALTER TABLE public.interview_cleanup_logs ENABLE ROW LEVEL SECURITY;

-- Only system can manage cleanup logs
CREATE POLICY "System can manage cleanup logs" ON public.interview_cleanup_logs
FOR ALL USING (true);