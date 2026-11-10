-- Fix leaderboard ranking system

-- Step 1: Update populate_current_leaderboard() to calculate ranks
CREATE OR REPLACE FUNCTION populate_current_leaderboard()
RETURNS TABLE(entries_created INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cycle_id UUID;
  v_entries_created INTEGER := 0;
BEGIN
  -- Get current active cycle
  SELECT id INTO v_cycle_id
  FROM referral_leaderboard_cycles
  WHERE status = 'active'
  ORDER BY cycle_start DESC
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION 'No active cycle found';
  END IF;

  -- Insert/update leaderboard entries
  INSERT INTO referral_leaderboard_entries (
    cycle_id,
    user_id,
    active_referrals_count,
    last_referral_at
  )
  SELECT 
    v_cycle_id,
    ur.referrer_id,
    COUNT(DISTINCT ur.referred_user_id) as active_count,
    MAX(ur.created_at) as last_referral
  FROM user_referrals ur
  INNER JOIN profiles p ON p.user_id = ur.referred_user_id
  WHERE ur.is_active = true
    AND p.account_status = 'active'
    AND ur.created_at >= (SELECT cycle_start FROM referral_leaderboard_cycles WHERE id = v_cycle_id)
    AND ur.created_at <= (SELECT cycle_end FROM referral_leaderboard_cycles WHERE id = v_cycle_id)
  GROUP BY ur.referrer_id
  ON CONFLICT (cycle_id, user_id) 
  DO UPDATE SET
    active_referrals_count = EXCLUDED.active_referrals_count,
    last_referral_at = EXCLUDED.last_referral_at,
    updated_at = now();

  GET DIAGNOSTICS v_entries_created = ROW_COUNT;

  -- Recalculate ranks for all entries in this cycle
  WITH ranked_entries AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY active_referrals_count DESC, last_referral_at ASC
      ) AS new_rank
    FROM referral_leaderboard_entries
    WHERE cycle_id = v_cycle_id
      AND active_referrals_count > 0
  )
  UPDATE referral_leaderboard_entries e
  SET rank = r.new_rank, updated_at = now()
  FROM ranked_entries r
  WHERE e.id = r.id;

  RETURN QUERY SELECT v_entries_created;
END;
$$;

-- Step 2: Update refresh_current_leaderboard()
CREATE OR REPLACE FUNCTION refresh_current_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM populate_current_leaderboard();
  
  RAISE NOTICE 'Leaderboard refreshed successfully';
END;
$$;

-- Step 3: Fix existing NULL ranks in current active cycle
WITH ranked_entries AS (
  SELECT 
    e.id,
    ROW_NUMBER() OVER (
      ORDER BY e.active_referrals_count DESC, e.last_referral_at ASC
    ) AS new_rank
  FROM referral_leaderboard_entries e
  INNER JOIN referral_leaderboard_cycles c ON c.id = e.cycle_id
  WHERE c.status = 'active'
    AND e.active_referrals_count > 0
)
UPDATE referral_leaderboard_entries e
SET rank = r.new_rank, updated_at = now()
FROM ranked_entries r
WHERE e.id = r.id;

-- Step 4: Immediately refresh the leaderboard to populate any missing entries
SELECT populate_current_leaderboard();