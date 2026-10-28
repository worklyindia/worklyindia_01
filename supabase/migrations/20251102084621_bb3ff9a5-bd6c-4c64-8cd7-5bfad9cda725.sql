-- Add RLS policy for referrers to view their referred users' profiles
CREATE POLICY "Referrers can view their referred users' profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT referred_user_id 
    FROM user_referrals 
    WHERE referrer_id = auth.uid() AND is_active = true
  )
);

-- Add RLS policy for referrers to view their referred companies
CREATE POLICY "Referrers can view their referred companies"
ON companies FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT referred_user_id 
    FROM user_referrals 
    WHERE referrer_id = auth.uid() AND is_active = true
  )
);