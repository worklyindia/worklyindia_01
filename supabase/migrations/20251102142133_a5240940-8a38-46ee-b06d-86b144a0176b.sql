-- Add unique constraints to prevent duplicate leaderboard entries
DO $$ 
BEGIN
  -- Add unique constraint on referral_leaderboard_entries
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_cycle_user'
  ) THEN
    ALTER TABLE referral_leaderboard_entries 
    ADD CONSTRAINT unique_cycle_user UNIQUE (cycle_id, user_id);
  END IF;

  -- Add unique constraint on referral_leaderboard_history
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_cycle_user_history'
  ) THEN
    ALTER TABLE referral_leaderboard_history 
    ADD CONSTRAINT unique_cycle_user_history UNIQUE (cycle_id, user_id);
  END IF;
END $$;

-- Fix security: Set search_path for all referral-related functions
DO $$
BEGIN
  -- Set search_path for referral functions
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_unique_referral_code') THEN
    ALTER FUNCTION generate_unique_referral_code(uuid) SET search_path TO 'public';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_current_leaderboard') THEN
    ALTER FUNCTION get_current_leaderboard(integer) SET search_path TO 'public';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_leaderboard_position') THEN
    ALTER FUNCTION get_user_leaderboard_position(uuid) SET search_path TO 'public';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_leaderboard_history') THEN
    ALTER FUNCTION get_leaderboard_history(uuid) SET search_path TO 'public';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_current_leaderboard') THEN
    ALTER FUNCTION refresh_current_leaderboard() SET search_path TO 'public';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'initialize_monthly_cycle') THEN
    ALTER FUNCTION initialize_monthly_cycle() SET search_path TO 'public';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'finalize_monthly_cycle') THEN
    ALTER FUNCTION finalize_monthly_cycle(uuid) SET search_path TO 'public';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_and_award_competition_prizes') THEN
    ALTER FUNCTION calculate_and_award_competition_prizes(uuid) SET search_path TO 'public';
  END IF;
END $$;

-- Add comment explaining October cycle had no participants
COMMENT ON TABLE referral_leaderboard_history IS 
'Stores finalized leaderboard results. October 2025 cycle had no participants (0 entries), which is why it has no history records.';