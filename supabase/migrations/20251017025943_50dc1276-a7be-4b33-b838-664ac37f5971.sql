-- Drop the old constraint that doesn't include '100ms'
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_mode_check;

-- Add new constraint with '100ms' included as a valid mode
ALTER TABLE interviews ADD CONSTRAINT interviews_mode_check 
CHECK (mode = ANY (ARRAY['online'::text, 'phone'::text, 'in_person'::text, 'dailyco'::text, 'videosdk'::text, 'jitsi'::text, '100ms'::text]));