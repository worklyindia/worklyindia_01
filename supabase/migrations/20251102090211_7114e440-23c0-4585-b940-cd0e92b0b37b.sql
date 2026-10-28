-- Create missing referral relationships for today's signups
-- User 1: kijalrajput009@gmail.com (Gohil Vishalbhai) - Profile Complete
INSERT INTO user_referrals (
  referrer_id,
  referred_user_id,
  referral_code_used,
  is_active,
  created_at
)
VALUES (
  '1769cddb-7244-4b4b-a86f-e0ca3bc028db', -- Referrer with code WFHDA642
  '51bd3943-753c-41e3-a892-d18fe9e7d5df', -- kijalrajput009@gmail.com
  'WFHDA642',
  true,
  '2025-11-02 08:38:18.541765+00' -- Original signup time
)
ON CONFLICT DO NOTHING;

-- User 2: pujasinhrajput@gmail.com - Profile NOT Complete yet
INSERT INTO user_referrals (
  referrer_id,
  referred_user_id,
  referral_code_used,
  is_active,
  created_at
)
VALUES (
  '1769cddb-7244-4b4b-a86f-e0ca3bc028db', -- Referrer with code WFHDA642
  '788d692d-9a27-4f3f-b272-9281319a1294', -- pujasinhrajput@gmail.com
  'WFHDA642',
  true,
  '2025-11-02 08:51:30.07048+00' -- Original signup time
)
ON CONFLICT DO NOTHING;