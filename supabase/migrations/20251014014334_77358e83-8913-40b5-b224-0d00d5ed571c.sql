-- Update the interviews table mode check constraint to include 'dailyco'
-- First, drop the existing constraint
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_mode_check;

-- Add the updated constraint that includes 'dailyco'
ALTER TABLE interviews ADD CONSTRAINT interviews_mode_check 
  CHECK (mode IN ('online', 'phone', 'in_person', 'dailyco'));