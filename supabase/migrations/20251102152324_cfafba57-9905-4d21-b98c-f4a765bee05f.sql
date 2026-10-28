-- Fix leaderboard to count unique referred users (not commission records)
CREATE OR REPLACE FUNCTION populate_current_leaderboard(
  v_cycle_id uuid, 
  cycle_start timestamptz, 
  cycle_end timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM referral_leaderboard_entries WHERE cycle_id = v_cycle_id;

  -- Step 1: Find unique referred users who have completed commissions
  WITH users_with_commissions AS (
    SELECT DISTINCT referred_user_id
    FROM referral_commissions
    WHERE status = 'completed' 
      AND commission_amount > 0
  )
  
  -- Step 2: Count unique referred users (not commission records)
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
  INNER JOIN users_with_commissions uwc ON uwc.referred_user_id = ur.referred_user_id
  WHERE ur.is_active = true
    AND p.account_status = 'active'
    AND ur.created_at >= cycle_start
    AND ur.created_at < cycle_end
  GROUP BY ur.referrer_id
  HAVING COUNT(DISTINCT ur.referred_user_id) > 0;

  -- Assign ranks
  WITH ranked_entries AS (
    SELECT 
      id,
      DENSE_RANK() OVER (ORDER BY active_referrals_count DESC, last_referral_at DESC) as new_rank
    FROM referral_leaderboard_entries
    WHERE cycle_id = v_cycle_id
  )
  UPDATE referral_leaderboard_entries e
  SET rank = r.new_rank
  FROM ranked_entries r
  WHERE e.id = r.id;

  RAISE NOTICE 'Leaderboard populated for cycle % with % entries', 
    v_cycle_id, 
    (SELECT COUNT(*) FROM referral_leaderboard_entries WHERE cycle_id = v_cycle_id);
END;
$$;