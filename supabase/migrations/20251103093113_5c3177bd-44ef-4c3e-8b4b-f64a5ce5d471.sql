-- Create function to get financial statistics by period (24h, week, month)
CREATE OR REPLACE FUNCTION get_financial_statistics_by_period(p_period text DEFAULT 'today')
RETURNS TABLE (
  total_wallet_points bigint,
  total_wallet_purchased bigint,
  total_wallet_spent bigint,
  total_referral_balance numeric,
  total_referral_earned numeric,
  total_referral_withdrawn numeric,
  total_users_with_wallet bigint,
  total_users_with_referral bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  period_start timestamp with time zone;
BEGIN
  -- Calculate period start time
  period_start := CASE 
    WHEN p_period = 'today' THEN NOW() - INTERVAL '24 hours'
    WHEN p_period = 'week' THEN NOW() - INTERVAL '7 days'
    WHEN p_period = 'month' THEN NOW() - INTERVAL '30 days'
    ELSE NOW() - INTERVAL '24 hours'
  END;

  RETURN QUERY
  SELECT
    -- Current wallet points balance (all-time)
    COALESCE(SUM(w.current_balance), 0)::bigint as total_wallet_points,
    
    -- Wallet purchased in period (24h)
    COALESCE((
      SELECT SUM(pt.points_amount)
      FROM points_transactions pt
      WHERE pt.transaction_type = 'purchase'
      AND pt.created_at >= period_start
    ), 0)::bigint as total_wallet_purchased,
    
    -- Wallet spent in period (24h)
    COALESCE((
      SELECT SUM(pt.points_amount)
      FROM points_transactions pt
      WHERE pt.transaction_type = 'spend'
      AND pt.created_at >= period_start
    ), 0)::bigint as total_wallet_spent,
    
    -- Current referral balance (all-time)
    COALESCE(SUM(rw.current_balance), 0)::numeric as total_referral_balance,
    
    -- Referral earned in period (24h)
    COALESCE((
      SELECT SUM(rc.commission_amount)
      FROM referral_commissions rc
      WHERE rc.status = 'completed'
      AND rc.created_at >= period_start
    ), 0)::numeric as total_referral_earned,
    
    -- Referral withdrawn in period (24h)
    COALESCE((
      SELECT SUM(rwr.amount)
      FROM referral_withdrawal_requests rwr
      WHERE rwr.status = 'completed'
      AND rwr.created_at >= period_start
    ), 0)::numeric as total_referral_withdrawn,
    
    -- Total users with wallet
    COUNT(DISTINCT w.user_id)::bigint as total_users_with_wallet,
    
    -- Total users with referral balance
    COUNT(DISTINCT rw.user_id)::bigint as total_users_with_referral
    
  FROM wallets w
  FULL OUTER JOIN referral_wallets rw ON true;
END;
$$;