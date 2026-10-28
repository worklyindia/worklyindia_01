-- Add Jitsi Meet fields to interviews table
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS jitsi_room_name text,
ADD COLUMN IF NOT EXISTS jitsi_meeting_url text,
ADD COLUMN IF NOT EXISTS jitsi_password text;

-- Add comments
COMMENT ON COLUMN interviews.jitsi_room_name IS 'Unique room name for Jitsi Meet (e.g., wfh-interview-uuid)';
COMMENT ON COLUMN interviews.jitsi_meeting_url IS 'Full Jitsi Meet URL (meet.jit.si/room-name)';
COMMENT ON COLUMN interviews.jitsi_password IS 'Optional password for meeting security';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_interviews_jitsi_room ON interviews(jitsi_room_name) WHERE jitsi_room_name IS NOT NULL;