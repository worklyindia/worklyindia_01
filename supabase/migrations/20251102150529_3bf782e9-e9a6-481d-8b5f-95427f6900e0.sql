-- Fix populate_current_leaderboard to count commission-based referrals
-- This ensures leaderboard counts match the actual commission-generating users

CREATE OR REPLACE FUNCTION populate_current_leaderboard(v_cycle_id uuid, cycle_start timestamptz, cycle_end timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clear existing entries for this cycle
  DELETE FROM referral_leaderboard_entries WHERE cycle_id = v_cycle_id;

  -- Populate with current stats (COUNT ONLY COMMISSION-GENERATING REFERRALS)
  INSERT INTO referral_leaderboard_entries (
    cycle_id,
    user_id,
    active_referrals_count,
    last_referral_at
  )
  SELECT 
    v_cycle_id,
    ur.referrer_id,
    -- Count only referrals with completed commissions
    COUNT(DISTINCT CASE 
      WHEN rc.status = 'completed' AND rc.commission_amount > 0 
      THEN ur.referred_user_id 
    END) as active_count,
    MAX(ur.created_at) as last_referral
  FROM user_referrals ur
  INNER JOIN profiles p ON p.user_id = ur.referred_user_id
  LEFT JOIN referral_commissions rc 
    ON rc.referred_user_id = ur.referred_user_id
  WHERE ur.is_active = true
    AND p.account_status = 'active'
    AND ur.created_at >= cycle_start
    AND ur.created_at < cycle_end
  GROUP BY ur.referrer_id
  HAVING COUNT(DISTINCT CASE 
    WHEN rc.status = 'completed' AND rc.commission_amount > 0 
    THEN ur.referred_user_id 
  END) > 0;

  -- Assign ranks based on active referrals count (ties get same rank)
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

  -- Log the operation
  RAISE NOTICE 'Leaderboard populated for cycle % with % entries', 
    v_cycle_id, 
    (SELECT COUNT(*) FROM referral_leaderboard_entries WHERE cycle_id = v_cycle_id);
END;
$$;