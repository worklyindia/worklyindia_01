-- Add Daily.co integration columns to interviews table
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS daily_room_name TEXT,
ADD COLUMN IF NOT EXISTS daily_room_url TEXT,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMPTZ;

-- Add index for quick room lookups
CREATE INDEX IF NOT EXISTS idx_interviews_daily_room ON interviews(daily_room_name);

-- Add comment for documentation
COMMENT ON COLUMN interviews.daily_room_name IS 'Unique Daily.co room identifier';
COMMENT ON COLUMN interviews.daily_room_url IS 'Full Daily.co room URL for video call';
COMMENT ON COLUMN interviews.recording_url IS 'Post-interview recording download link';
COMMENT ON COLUMN interviews.actual_start_time IS 'Timestamp when video call was actually joined';
COMMENT ON COLUMN interviews.actual_end_time IS 'Timestamp when video call was actually ended';