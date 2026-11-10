-- Add videosdk_session_id column to track active VideoSDK sessions for auto-ending
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS videosdk_session_id TEXT;

-- Add index for faster queries on active sessions
CREATE INDEX IF NOT EXISTS idx_interviews_videosdk_session 
ON public.interviews(videosdk_session_id) 
WHERE videosdk_session_id IS NOT NULL AND status = 'scheduled';

-- Add index for scheduled end time queries
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_end 
ON public.interviews(scheduled_end_at, status) 
WHERE scheduled_end_at IS NOT NULL AND status IN ('scheduled', 'in_progress');