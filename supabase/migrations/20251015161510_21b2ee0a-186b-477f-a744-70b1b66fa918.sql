-- Drop the existing constraint that's missing videosdk and jitsi modes
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_mode_check;

-- Add updated constraint with all valid modes including videosdk and jitsi
ALTER TABLE interviews ADD CONSTRAINT interviews_mode_check 
  CHECK (mode IN ('online', 'phone', 'in_person', 'dailyco', 'videosdk', 'jitsi'));