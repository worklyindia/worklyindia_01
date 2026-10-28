-- Add 100ms.live columns to interviews table
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS hms_room_id TEXT,
ADD COLUMN IF NOT EXISTS hms_room_url TEXT,
ADD COLUMN IF NOT EXISTS hms_host_token TEXT,
ADD COLUMN IF NOT EXISTS hms_participant_tokens JSONB DEFAULT '{}'::jsonb;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_interviews_hms_room_id ON public.interviews(hms_room_id);

-- Add comment for documentation
COMMENT ON COLUMN public.interviews.hms_room_id IS '100ms room identifier';
COMMENT ON COLUMN public.interviews.hms_room_url IS '100ms meeting URL for participants';
COMMENT ON COLUMN public.interviews.hms_host_token IS 'Auth token for interview host';
COMMENT ON COLUMN public.interviews.hms_participant_tokens IS 'JSONB object mapping applicant_id to their auth tokens';