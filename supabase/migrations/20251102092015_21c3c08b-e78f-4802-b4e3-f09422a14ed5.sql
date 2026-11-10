-- Fix #1: Add cycle_id to referral_commissions table
ALTER TABLE referral_commissions 
ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES referral_leaderboard_cycles(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_referral_commissions_cycle_id ON referral_commissions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions(status);

-- Fix #2: Populate existing commissions with current active cycle
UPDATE referral_commissions 
SET cycle_id = (
  SELECT id 
  FROM referral_leaderboard_cycles 
  WHERE status = 'active' 
  ORDER BY cycle_start DESC 
  LIMIT 1
)
WHERE cycle_id IS NULL 
  AND created_at >= (
    SELECT cycle_start 
    FROM referral_leaderboard_cycles 
    WHERE status = 'active' 
    ORDER BY cycle_start DESC 
    LIMIT 1
  );

-- Fix #3: Create function to populate current leaderboard
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

  -- Insert/update leaderboard entries for all users with active referrals
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

  RETURN QUERY SELECT v_entries_created;
END;
$$;

-- Fix #4: Create function to refresh leaderboard (call this regularly)
CREATE OR REPLACE FUNCTION refresh_current_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM populate_current_leaderboard();
END;
$$;

-- Fix #5: Update the trigger function to handle cycle_id properly
CREATE OR REPLACE FUNCTION update_leaderboard_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cycle_id UUID;
  v_referrer_id UUID;
  v_active_count INTEGER;
BEGIN
  -- Get current active cycle
  SELECT id INTO v_cycle_id
  FROM referral_leaderboard_cycles
  WHERE status = 'active'
  ORDER BY cycle_start DESC
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get referrer from commission
  SELECT referrer_id INTO v_referrer_id
  FROM referral_commissions
  WHERE id = NEW.id;

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count active referrals for this user in current cycle
  SELECT COUNT(DISTINCT ur.referred_user_id) INTO v_active_count
  FROM user_referrals ur
  INNER JOIN profiles p ON p.user_id = ur.referred_user_id
  WHERE ur.referrer_id = v_referrer_id
    AND ur.is_active = true
    AND p.account_status = 'active'
    AND ur.created_at >= (SELECT cycle_start FROM referral_leaderboard_cycles WHERE id = v_cycle_id)
    AND ur.created_at <= (SELECT cycle_end FROM referral_leaderboard_cycles WHERE id = v_cycle_id);

  -- Insert or update leaderboard entry
  INSERT INTO referral_leaderboard_entries (
    cycle_id,
    user_id,
    active_referrals_count,
    last_referral_at
  )
  VALUES (
    v_cycle_id,
    v_referrer_id,
    v_active_count,
    now()
  )
  ON CONFLICT (cycle_id, user_id)
  DO UPDATE SET
    active_referrals_count = v_active_count,
    last_referral_at = now(),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Fix #6: Populate the current leaderboard immediately
SELECT populate_current_leaderboard();