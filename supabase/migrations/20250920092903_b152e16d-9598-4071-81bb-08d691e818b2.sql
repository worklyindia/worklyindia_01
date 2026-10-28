-- Add RLS policies for referral_wallets
DROP POLICY IF EXISTS "Users can view their own referral wallet" ON public.referral_wallets;
DROP POLICY IF EXISTS "System can manage referral wallets" ON public.referral_wallets;

CREATE POLICY "Users can view their own referral wallet"
ON public.referral_wallets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage referral wallets"
ON public.referral_wallets FOR ALL
USING (true);

-- Add RLS policies for user_referrals
DROP POLICY IF EXISTS "Users can view their referrals" ON public.user_referrals;
DROP POLICY IF EXISTS "System can manage user referrals" ON public.user_referrals;

CREATE POLICY "Users can view their referrals"
ON public.user_referrals FOR SELECT
USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

CREATE POLICY "System can manage user referrals"
ON public.user_referrals FOR ALL
USING (true);