-- Add VideoSDK-specific columns to interviews table
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS videosdk_room_id text,
ADD COLUMN IF NOT EXISTS videosdk_meeting_url text,
ADD COLUMN IF NOT EXISTS videosdk_host_token text,
ADD COLUMN IF NOT EXISTS videosdk_participant_tokens jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS videosdk_recording_id text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_interviews_videosdk_room_id ON public.interviews(videosdk_room_id);

-- Add comment for documentation
COMMENT ON COLUMN public.interviews.videosdk_room_id IS 'VideoSDK room identifier';
COMMENT ON COLUMN public.interviews.videosdk_meeting_url IS 'VideoSDK meeting URL';
COMMENT ON COLUMN public.interviews.videosdk_host_token IS 'JWT token for interview host';
COMMENT ON COLUMN public.interviews.videosdk_participant_tokens IS 'JWT tokens for participants mapped by user_id';
COMMENT ON COLUMN public.interviews.videosdk_recording_id IS 'VideoSDK recording identifier';