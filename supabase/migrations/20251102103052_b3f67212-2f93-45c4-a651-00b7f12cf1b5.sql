
-- =====================================================
-- FIX: Filter banned/deleted referrers from leaderboard
-- =====================================================

-- Update get_current_leaderboard to exclude banned referrers
CREATE OR REPLACE FUNCTION public.get_current_leaderboard(p_limit INTEGER DEFAULT 999999)
RETURNS TABLE (
  rank INTEGER,
  user_id UUID,
  company_name TEXT,
  logo_url TEXT,
  active_referrals_count INTEGER,
  last_referral_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.rank::INTEGER,
    e.user_id,
    COALESCE(c.company_name, 'Company') as company_name,
    c.logo_url,
    e.active_referrals_count::INTEGER,
    e.last_referral_at
  FROM referral_leaderboard_entries e
  INNER JOIN referral_leaderboard_cycles cy ON cy.id = e.cycle_id
  LEFT JOIN companies c ON c.user_id = e.user_id
  INNER JOIN profiles p ON p.user_id = e.user_id
  WHERE cy.status = 'active'
    AND e.active_referrals_count > 0
    AND e.rank IS NOT NULL
    AND c.account_status = 'active'  -- Exclude banned companies
    AND p.account_status = 'active'   -- Exclude banned/deleted profiles
  ORDER BY e.rank ASC
  LIMIT p_limit;
END;
$$;

-- Update get_user_leaderboard_position to also filter by account status
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
  -- Get current active cycle
  SELECT id, cycle_end INTO v_cycle_id, v_cycle_end
  FROM referral_leaderboard_cycles
  WHERE status = 'active'
  ORDER BY cycle_start DESC
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
    RETURN; -- Don't show position for banned users
  END IF;
  
  -- Get user's position
  SELECT e.rank, e.active_referrals_count 
  INTO v_current_rank, v_current_count
  FROM referral_leaderboard_entries e
  WHERE e.cycle_id = v_cycle_id
    AND e.user_id = p_user_id;
  
  -- If user not in leaderboard, return NULL
  IF v_current_rank IS NULL THEN
    RETURN;
  END IF;
  
  -- Get next rank's count (one rank above)
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

COMMENT ON FUNCTION public.get_current_leaderboard IS 'Returns current leaderboard excluding banned/deleted accounts';
COMMENT ON FUNCTION public.get_user_leaderboard_position IS 'Returns user position only if account is active';
