-- Add host control fields to interviews table
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS host_meeting_token TEXT,
ADD COLUMN IF NOT EXISTS participant_meeting_tokens JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN interviews.host_user_id IS 'User ID of the interview host (employer who scheduled)';
COMMENT ON COLUMN interviews.host_meeting_token IS 'Daily.co meeting token for host with full permissions';
COMMENT ON COLUMN interviews.participant_meeting_tokens IS 'Daily.co meeting tokens for participants with limited permissions';
