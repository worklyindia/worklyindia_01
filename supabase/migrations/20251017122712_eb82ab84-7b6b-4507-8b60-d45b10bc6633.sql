-- Drop the old constraint
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_mode_check;

-- Add updated constraint with all valid modes including iframe variants
ALTER TABLE interviews ADD CONSTRAINT interviews_mode_check 
CHECK (mode = ANY (ARRAY[
  'online'::text, 
  'phone'::text, 
  'in_person'::text, 
  'dailyco'::text, 
  'videosdk'::text, 
  'videosdk_iframe'::text,
  'jitsi'::text, 
  '100ms'::text,
  '100ms_iframe'::text
]));