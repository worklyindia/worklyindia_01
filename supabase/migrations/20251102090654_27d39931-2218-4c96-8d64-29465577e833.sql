-- Create Monthly Referral Competition System Tables

-- 1. Competition Cycles Table
CREATE TABLE IF NOT EXISTS referral_competition_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  total_participants INTEGER DEFAULT 0,
  prizes_distributed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Competition Leaderboard Table
CREATE TABLE IF NOT EXISTS referral_competition_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES referral_competition_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  referral_count INTEGER DEFAULT 0,
  active_referrals_count INTEGER DEFAULT 0,
  rank INTEGER,
  prize_won NUMERIC(10,2) DEFAULT 0,
  is_prize_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cycle_id, user_id)
);

-- 3. Competition Prizes Configuration Table
CREATE TABLE IF NOT EXISTS referral_competition_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank INTEGER NOT NULL UNIQUE CHECK (rank >= 1 AND rank <= 3),
  prize_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default prize amounts
INSERT INTO referral_competition_prizes (rank, prize_amount)
VALUES 
  (1, 5000),  -- 1st place: ₹5000
  (2, 3000),  -- 2nd place: ₹3000
  (3, 2000)   -- 3rd place: ₹2000
ON CONFLICT (rank) DO NOTHING;

-- 4. Enable RLS on all tables
ALTER TABLE referral_competition_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_competition_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_competition_prizes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for competition_cycles
CREATE POLICY "Anyone can view active cycles"
ON referral_competition_cycles FOR SELECT
TO authenticated
USING (status = 'active');

CREATE POLICY "Admins can manage cycles"
ON referral_competition_cycles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role IN ('admin', 'owner')
  )
);

-- 6. RLS Policies for leaderboard
CREATE POLICY "Anyone can view leaderboard"
ON referral_competition_leaderboard FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can manage leaderboard"
ON referral_competition_leaderboard FOR ALL
TO authenticated
USING (true);

-- 7. RLS Policies for prizes
CREATE POLICY "Anyone can view prizes"
ON referral_competition_prizes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage prizes"
ON referral_competition_prizes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.role IN ('admin', 'owner')
  )
);

-- 8. Create first active cycle (Current month)
INSERT INTO referral_competition_cycles (
  cycle_name,
  start_date,
  end_date,
  status
)
VALUES (
  'November 2025',
  '2025-11-01 00:00:00+00',
  '2025-11-30 23:59:59+00',
  'active'
)
ON CONFLICT DO NOTHING;

-- 9. Function to update leaderboard
CREATE OR REPLACE FUNCTION update_competition_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_cycle_id UUID;
BEGIN
  -- Get active cycle
  SELECT id INTO active_cycle_id
  FROM referral_competition_cycles
  WHERE status = 'active'
  AND NOW() BETWEEN start_date AND end_date
  LIMIT 1;

  IF active_cycle_id IS NULL THEN
    RETURN;
  END IF;

  -- Clear existing leaderboard for this cycle
  DELETE FROM referral_competition_leaderboard
  WHERE cycle_id = active_cycle_id;

  -- Insert updated leaderboard with active referrals count
  INSERT INTO referral_competition_leaderboard (
    cycle_id,
    user_id,
    referral_count,
    active_referrals_count,
    rank
  )
  SELECT 
    active_cycle_id,
    referrer_id as user_id,
    COUNT(*) as referral_count,
    COUNT(*) FILTER (WHERE is_active = true) as active_referrals_count,
    RANK() OVER (ORDER BY COUNT(*) FILTER (WHERE is_active = true) DESC) as rank
  FROM user_referrals
  WHERE created_at >= (SELECT start_date FROM referral_competition_cycles WHERE id = active_cycle_id)
  AND created_at <= (SELECT end_date FROM referral_competition_cycles WHERE id = active_cycle_id)
  GROUP BY referrer_id
  HAVING COUNT(*) FILTER (WHERE is_active = true) > 0
  ORDER BY active_referrals_count DESC;

  -- Update cycle participant count
  UPDATE referral_competition_cycles
  SET total_participants = (
    SELECT COUNT(*) FROM referral_competition_leaderboard WHERE cycle_id = active_cycle_id
  )
  WHERE id = active_cycle_id;
END;
$$;

-- 10. Trigger to update leaderboard when referral is created
CREATE OR REPLACE FUNCTION trigger_update_leaderboard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM update_competition_leaderboard();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_leaderboard_on_referral ON user_referrals;
CREATE TRIGGER update_leaderboard_on_referral
AFTER INSERT OR UPDATE ON user_referrals
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_update_leaderboard();

-- 11. Initialize leaderboard with current data
SELECT update_competition_leaderboard();