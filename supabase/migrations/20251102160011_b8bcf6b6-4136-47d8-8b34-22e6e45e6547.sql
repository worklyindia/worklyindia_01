-- Drop the OLD buggy version of populate_current_leaderboard (without parameters)
DROP FUNCTION IF EXISTS public.populate_current_leaderboard();

-- Update refresh function to call the correct version WITH parameters
CREATE OR REPLACE FUNCTION public.refresh_current_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cycle_id UUID;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
BEGIN
  -- Get active cycle details
  SELECT id, cycle_start, cycle_end 
  INTO v_cycle_id, v_cycle_start, v_cycle_end
  FROM referral_leaderboard_cycles
  WHERE status = 'active'
  ORDER BY cycle_start DESC
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RAISE NOTICE '⚠️ No active cycle found';
    RETURN;
  END IF;

  -- Call the correct version with parameters
  PERFORM populate_current_leaderboard(v_cycle_id, v_cycle_start, v_cycle_end);
  
  RAISE NOTICE '✅ Leaderboard refreshed successfully for cycle %', v_cycle_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Leaderboard refresh failed: %', SQLERRM;
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.refresh_current_leaderboard IS 'Updated to call populate_current_leaderboard with correct parameters';

-- Immediately refresh to update counts with correct logic
SELECT refresh_current_leaderboard();