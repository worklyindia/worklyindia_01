-- Add missing cycle_start and cycle_end columns to referral_leaderboard_history
-- This fixes the error in finalize_monthly_cycle() function

ALTER TABLE public.referral_leaderboard_history 
ADD COLUMN IF NOT EXISTS cycle_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cycle_end TIMESTAMP WITH TIME ZONE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_history_cycle_dates 
ON public.referral_leaderboard_history(cycle_start, cycle_end);

-- Add comments
COMMENT ON COLUMN public.referral_leaderboard_history.cycle_start IS 
'Start date of the competition cycle (e.g., Nov 1, 2025 05:30:00 IST)';

COMMENT ON COLUMN public.referral_leaderboard_history.cycle_end IS 
'End date of the competition cycle (e.g., Dec 1, 2025 05:29:59 IST)';

-- Backfill existing rows (if any) with cycle data from referral_leaderboard_cycles
UPDATE public.referral_leaderboard_history h
SET 
  cycle_start = c.cycle_start,
  cycle_end = c.cycle_end
FROM public.referral_leaderboard_cycles c
WHERE h.cycle_id = c.id
  AND h.cycle_start IS NULL;