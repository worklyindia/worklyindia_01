-- Fix ambiguous column error in get_user_leaderboard_position
CREATE OR REPLACE FUNCTION public.get_user_leaderboard_position(p_user_id UUID)
RETURNS TABLE (
  rank INTEGER,
  active_referrals_count INTEGER,
  next_rank_gap INTEGER,
  cycle_id UUID,
  cycle_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_rank INTEGER;
  v_current_count INTEGER;
  v_next_rank_count INTEGER;
  v_cycle_id UUID;
  v_cycle_end TIMESTAMPTZ;
BEGIN
  -- Get current active cycle (FIXED: Add table alias to avoid ambiguity)
  SELECT rlc.id, rlc.cycle_end INTO v_cycle_id, v_cycle_end
  FROM referral_leaderboard_cycles rlc
  WHERE rlc.status = 'active'
  ORDER BY rlc.cycle_start DESC
  LIMIT 1;
  
  IF v_cycle_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if user's account is active
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    LEFT JOIN companies c ON c.user_id = p.user_id
    WHERE p.user_id = p_user_id
      AND p.account_status = 'active'
      AND (c.account_status = 'active' OR c.account_status IS NULL)
  ) THEN
    RETURN;
  END IF;
  
  -- Get user's position
  SELECT e.rank, e.active_referrals_count 
  INTO v_current_rank, v_current_count
  FROM referral_leaderboard_entries e
  WHERE e.cycle_id = v_cycle_id
    AND e.user_id = p_user_id;
  
  IF v_current_rank IS NULL THEN
    RETURN;
  END IF;
  
  -- Get next rank's count
  SELECT active_referrals_count INTO v_next_rank_count
  FROM referral_leaderboard_entries
  WHERE cycle_id = v_cycle_id
    AND rank = v_current_rank - 1;
  
  RETURN QUERY
  SELECT 
    v_current_rank,
    v_current_count,
    COALESCE(v_next_rank_count - v_current_count, 0) as next_rank_gap,
    v_cycle_id,
    v_cycle_end;
END;
$$;

COMMENT ON FUNCTION public.get_user_leaderboard_position IS 'Fixed ambiguous column reference - Returns user position only if account is active';

-- Refresh leaderboard with new logic
SELECT refresh_current_leaderboard();